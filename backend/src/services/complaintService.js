import { Complaint } from '../models/Complaint.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { AppError } from '../utils/AppError.js';
import { createNotification } from './notificationService.js';
import { writeAudit } from './auditService.js';

const allowedTransitions = {
  SUBMITTED: ['ALLOCATED', 'REJECTED', 'ESCALATED'],
  NEW: ['ALLOCATED', 'ASSIGNED', 'REJECTED', 'ESCALATED'],
  ALLOCATED: ['IN_PROGRESS', 'ESCALATED', 'REASSIGNED'],
  ASSIGNED: ['IN_PROGRESS', 'ESCALATED', 'REASSIGNED'],
  IN_PROGRESS: ['PENDING_COMPLETION', 'PENDING_VERIFICATION', 'RESOLVED', 'ESCALATED'],
  PENDING_COMPLETION: ['CLOSED', 'IN_PROGRESS', 'REJECTED'],
  PENDING_VERIFICATION: ['CLOSED', 'IN_PROGRESS', 'PENDING_AUDIT', 'REOPENED'],
  RESOLVED: ['VERIFIED', 'REOPENED', 'CLOSED'],
  VERIFIED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  ESCALATED: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  REJECTED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED']
};

export const assertStatusTransition = (from, to) => {
  const normalizedTo = to === 'REASSIGNED' ? 'ALLOCATED' : to;
  if (!allowedTransitions[from]?.includes(to) && !allowedTransitions[from]?.includes(normalizedTo)) {
    throw new AppError(`Invalid status transition from ${from} to ${to}`, 400);
  }
};

export const promoteNextOfficerComplaint = async (officerId, actorId = officerId) => {
  const active = await Complaint.findOne({ assignedTo: officerId, status: 'IN_PROGRESS' });
  if (active) return active;

  const next = await Complaint.findOne({ assignedTo: officerId, status: { $in: ['ALLOCATED', 'ASSIGNED'] } }).sort({ createdAt: 1 });
  if (!next) return null;

  next.status = 'IN_PROGRESS';
  next.statusHistory.push({
    status: 'IN_PROGRESS',
    note: 'Automatically activated as the oldest pending officer complaint',
    changedBy: actorId
  });
  await next.save();
  return next;
};

export const updateComplaintStatus = async ({ complaint, status, note, actor, resolutionImages = [] }) => {
  assertStatusTransition(complaint.status, status);

  complaint.status = status;
  complaint.statusHistory.push({ status, note, changedBy: actor._id });

  if (status === 'ESCALATED') complaint.escalatedAt = new Date();
  if (status === 'PENDING_COMPLETION') {
    complaint.completionRequestedAt = new Date();
    complaint.resolutionImages = resolutionImages;
  }
  if (status === 'RESOLVED') {
    complaint.resolvedAt = new Date();
    complaint.resolutionImages = resolutionImages;
  }
  if (status === 'CLOSED') complaint.closedAt = new Date();

  await complaint.save();

  await writeAudit({
    actor: actor._id,
    action: 'COMPLAINT_STATUS_UPDATED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { status, note }
  });

  await createNotification({
    user: complaint.citizen,
    type: 'complaint_status',
    title: `Complaint ${status.toLowerCase().replace('_', ' ')}`,
    message: `Your complaint ${complaint.complaintId} is now ${status}.`,
    relatedComplaint: complaint._id
  });

  return complaint;
};

export const flagOverdueComplaints = async (actorId = null) => {
  const now = new Date();
  const overdue = await Complaint.find({
    dueAt: { $lt: now },
    status: { $in: ['SUBMITTED', 'NEW', 'ALLOCATED', 'ASSIGNED', 'IN_PROGRESS'] }
  });

  for (const complaint of overdue) {
    const failureCount = (complaint.vetoCount || 0) + (complaint.overrunCount || 0) + 1;
    complaint.status = 'ESCALATED';
    complaint.escalatedAt = now;
    complaint.priorityHint = 'urgent';
    complaint.overrunCount += 1;
    
    // Auto-extend due date by 1 day
    complaint.dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    complaint.statusHistory.push({
      status: 'ESCALATED',
      note: `Auto-escalated (SLA breach #${complaint.overrunCount}). Deadline extended by 24h.`,
      changedBy: actorId,
      changedAt: now
    });

    // Penalize trust scores (Increasing penalties)
    if (complaint.assignedTo) {
      const officer = await User.findById(complaint.assignedTo);
      if (officer) {
        const penalty = 10 * failureCount;
        officer.reputationScore -= penalty;
        await officer.save();
        
        // Penalize supervisor
        const supervisor = await User.findOne({ role: 'supervisor', department: complaint.department });
        if (supervisor) {
          const sPenalty = 5 * failureCount;
          supervisor.reputationScore -= sPenalty;
          await supervisor.save();
        }
      }
    }

    await escalateComplaint(complaint);
    await complaint.save();
  }

  return overdue.length;
};

export const escalateComplaint = async (complaint) => {
  const failureCount = (complaint.vetoCount || 0) + (complaint.overrunCount || 0);

  if (failureCount === 1) {
    // Strike 1: Change Officer
    const success = await assignRandomOfficer(complaint);
    if (!success) await handleEscalationFailure(complaint);
  } else if (failureCount === 2) {
    // Strike 2: Change Supervisor
    const success = await assignRandomSupervisor(complaint);
    if (!success) await handleEscalationFailure(complaint);
  } else {
    // Strike 3+: Critical failure
    await handleEscalationFailure(complaint);
  }
};

export const handleEscalationFailure = async (complaint) => {
  complaint.status = 'CLOSED';
  complaint.closedAt = new Date();
  complaint.statusHistory.push({
    status: 'CLOSED',
    note: 'System-forced closure: No suitable replacements available after multiple escalations. Triggering mandatory citizen audit.',
    changedBy: null
  });

  // Force a PENDING_AUDIT state for governance
  complaint.status = 'PENDING_AUDIT';
  
  await createNotification({
    user: null, // Admin
    type: 'system_alert',
    title: 'Escalation Failure',
    message: `Complaint ${complaint.complaintId} failed all escalation paths. Force-closing for audit.`,
    relatedComplaint: complaint._id
  });
};

export const assignRandomOfficer = async (complaint) => {
  if (complaint.assignedTo) complaint.previousOfficers.push(complaint.assignedTo);

  const eligibleOfficers = await User.find({
    role: 'officer',
    department: complaint.department,
    isActive: true,
    _id: { $nin: complaint.previousOfficers }
  });

  if (eligibleOfficers.length > 0) {
    const nextOfficer = eligibleOfficers[Math.floor(Math.random() * eligibleOfficers.length)];
    const hasActive = await Complaint.exists({ assignedTo: nextOfficer._id, status: 'IN_PROGRESS' });
    
    complaint.assignedTo = nextOfficer._id;
    complaint.status = hasActive ? 'ASSIGNED' : 'IN_PROGRESS';
    complaint.statusHistory.push({
      status: complaint.status,
      note: `Escalation: Reassigned to new officer ${nextOfficer.name}. ${hasActive ? 'Task added to queue.' : 'Task activated immediately.'}`,
      changedBy: null
    });
    
    await complaint.save();
    return true;
  }
  return false;
};

export const assignRandomSupervisor = async (complaint) => {
  // Find the current supervisor to add to previousSupervisors
  const currentSupervisor = await User.findOne({ role: 'supervisor', department: complaint.department });
  if (currentSupervisor) complaint.previousSupervisors.push(currentSupervisor._id);

  const eligibleSupervisors = await User.find({
    role: 'supervisor',
    isActive: true,
    _id: { $nin: complaint.previousSupervisors }
  });

  if (eligibleSupervisors.length > 0) {
    const nextSup = eligibleSupervisors[Math.floor(Math.random() * eligibleSupervisors.length)];
    complaint.department = nextSup.department;
    complaint.assignedTo = null; // Unassign officer for new supervisor to handle
    complaint.status = 'ESCALATED';
    complaint.statusHistory.push({
      status: 'ESCALATED',
      note: `Escalation Strike 2: Reassigned to new supervisor ${nextSup.name} (Dept: ${nextSup.department}).`,
      changedBy: null
    });
    return true;
  }
  return false;
};

export const checkAuditDeadlines = async () => {
  const now = new Date();
  const complaintsWithPendingAudits = await Complaint.find({
    status: 'PENDING_AUDIT',
    'auditors.dueDate': { $lt: now },
    'auditors.vote': { $exists: false }
  });

  for (const complaint of complaintsWithPendingAudits) {
    const tardyAuditors = complaint.auditors.filter(a => !a.vote && a.dueDate < now);
    for (const tardy of tardyAuditors) {
      await handleTardyAuditor(complaint, tardy.auditor);
    }
  }
};

const handleTardyAuditor = async (complaint, auditorId) => {
  const tardyUser = await User.findById(auditorId);
  if (tardyUser) {
    tardyUser.reputationScore -= 20;
    await tardyUser.save();
  }

  complaint.rejectedAuditors.push(auditorId);
  complaint.auditors = complaint.auditors.filter(a => !a.auditor.equals(auditorId));

  const currentAuditorIds = complaint.auditors.map(a => a.auditor);
  const excludedIds = [...currentAuditorIds, ...complaint.rejectedAuditors, complaint.citizen];

  const nextAuditor = await User.aggregate([
    { $match: { 
      isActive: true,
      _id: { $nin: excludedIds },
      reputationScore: { $gt: 150 }
    } },
    { $sample: { size: 1 } }
  ]);

  if (nextAuditor.length === 0) {
    const fallback = await User.aggregate([
      { $match: { 
        isActive: true,
        _id: { $nin: excludedIds },
        role: { $in: ['citizen', 'supervisor'] }
      } },
      { $sample: { size: 1 } }
    ]);
    if (fallback.length > 0) nextAuditor.push(fallback[0]);
  }

  if (nextAuditor.length > 0) {
    complaint.auditors.push({
      auditor: nextAuditor[0]._id,
      stakedPoints: 10,
      assignedAt: new Date(),
      dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000)
    });
  } else if (complaint.auditors.length === 0) {
    complaint.supervisorApprovalRequired = true;
  }

  await complaint.save();
};
