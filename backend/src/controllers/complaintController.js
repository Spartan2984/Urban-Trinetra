import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { ForumTopic } from '../models/ForumTopic.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { writeAudit } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';
import { flagOverdueComplaints, promoteNextOfficerComplaint, updateComplaintStatus, escalateComplaint } from '../services/complaintService.js';
import { generateSignature } from '../utils/cloudinary.js';
import exifParser from 'exif-parser';
import axios from 'axios';
import { verifyResolutionWithAI } from '../services/ai-verify.js';

const complaintQueryForRole = (user) => {
  if (user.role === 'citizen') return { $or: [{ citizen: user._id }, { 'auditors.auditor': user._id }] };
  if (user.role === 'officer') return { $or: [{ assignedTo: user._id }, { 'auditors.auditor': user._id }] };
  if (user.role === 'supervisor') return {};
  return {};
};

// Haversine formula
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

export const getUploadSignature = asyncHandler(async (req, res) => {
  const sig = generateSignature();
  return ok(res, 'Signature generated', sig);
});

export const createComplaint = asyncHandler(async (req, res) => {
  const longitude = Number(req.body.longitude);
  const latitude = Number(req.body.latitude);

  const duplicate = await Complaint.findOne({
    citizen: req.user._id,
    category: req.body.category,
    status: { $nin: ['CLOSED', 'REJECTED'] },
    'location.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: 100
      }
    },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  if (duplicate) {
    throw new AppError(`Possible duplicate complaint already exists: ${duplicate.complaintId}`, 409);
  }

  const images = req.body.images || [];
  if (!images.length) throw new AppError('At least one evidence photograph is required', 422);

  // EXIF Verification for Citizen Upload
  try {
    const firstImage = images[0];
    const response = await axios.get(firstImage.secure_url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const parser = exifParser.create(buffer);
    const result = parser.parse();

    if (result.tags) {
      const { GPSLatitude, GPSLongitude, DateTimeOriginal } = result.tags;
      
      // 1. Location match
      if (GPSLatitude && GPSLongitude) {
        const dist = getDistance(GPSLatitude, GPSLongitude, latitude, longitude);
        if (dist > 100) {
          console.warn(`The photo was taken ${Math.round(dist)}m away from the reported location. Evidence must be taken at the site.`);
        }
      } else {
        console.warn('The uploaded photo lacks GPS metadata. Please upload an original photograph with location enabled.');
      }

      // 2. Recency (optional but good: photo shouldn't be older than 48 hours for a NEW complaint)
      if (DateTimeOriginal) {
        const photoDate = new Date(DateTimeOriginal * 1000);
        const ageHours = (Date.now() - photoDate.getTime()) / (1000 * 60 * 60);
        if (ageHours > 48) {
          console.warn('The photo is too old. Please provide a fresh evidence photograph taken within the last 48 hours.');
        }
      }
    } else {
      console.warn('Could not read metadata from photo. Please upload an original photograph.');
    }
  } catch (err) {
    console.error('Citizen EXIF parse error:', err.message);
  }

  const complaint = await Complaint.create({
    citizen: req.user._id,
    category: req.body.category,
    title: req.body.title,
    description: req.body.description,
    priorityHint: req.body.priorityHint || 'medium',
    contactName: req.body.contactName || req.user.name,
    contactPhone: req.body.contactPhone || req.user.phone,
    location: {
      address: req.body.address,
      coordinates: { type: 'Point', coordinates: [longitude, latitude] }
    },
    images: images,
    statusHistory: [{ status: 'SUBMITTED', note: 'Complaint submitted', changedBy: req.user._id }]
  });

  const forumTopic = await ForumTopic.create({
    title: complaint.title,
    body: complaint.description,
    author: req.user._id,
    relatedComplaint: complaint._id
  });
  complaint.forumTopic = forumTopic._id;
  await complaint.save();

  await writeAudit({
    actor: req.user._id,
    action: 'COMPLAINT_CREATED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { complaintId: complaint.complaintId }
  });

  await createNotification({
    user: req.user._id,
    type: 'complaint_submitted',
    title: 'Complaint submitted',
    message: `Complaint ${complaint.complaintId} has been submitted.`,
    relatedComplaint: complaint._id
  });

  return ok(res, 'Complaint created successfully', { complaint, forumTopic }, 201);
});

export const listComplaints = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
  const query = { ...complaintQueryForRole(req.user) };

  if (req.query.status) query.status = req.query.status;
  if (req.query.category) query.category = req.query.category;
  if (req.query.department && ['admin', 'supervisor'].includes(req.user.role)) query.department = req.query.department;

  const [items, total] = await Promise.all([
    Complaint.find(query)
      .populate('citizen', 'name email phone')
      .populate('department', 'name code')
      .populate('assignedTo', 'name email')
      .sort(req.user.role === 'officer' ? { createdAt: 1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Complaint.countDocuments(query)
  ]);

  return ok(res, 'Complaints fetched', { items, total, page, pages: Math.ceil(total / limit) });
});

export const getComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate('citizen', 'name email phone')
    .populate('department', 'name code')
    .populate('assignedTo', 'name email')
    .populate('forumTopic', 'title score isDeleted')
    .populate('statusHistory.changedBy', 'name role')
    .populate('auditors.auditor', 'name reputationScore');

  if (!complaint) throw new AppError('Complaint not found', 404);

  // Access Control
  if (req.user.role === 'citizen') {
    const citizenId = complaint.citizen?._id || complaint.citizen;
    const isOwner = citizenId && citizenId.toString() === req.user._id.toString();
    
    const isAuditor = complaint.auditors?.some(a => {
      const auditorId = a.auditor?._id || a.auditor;
      return auditorId && auditorId.toString() === req.user._id.toString();
    });

    if (!isOwner && !isAuditor) {
      throw new AppError('You do not have permission to view this complaint', 403);
    }
  }

  return ok(res, 'Complaint fetched', { complaint });
});

export const assignComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!['SUBMITTED', 'NEW', 'REOPENED', 'ESCALATED'].includes(complaint.status)) {
    throw new AppError('Only submitted complaints can be allocated', 400);
  }

  const officer = await User.findOne({ _id: req.body.assignedTo, role: 'officer', isActive: true });
  if (!officer) throw new AppError('Active officer not found', 404);

  if (complaint.previousOfficers.includes(officer._id)) {
    throw new AppError('This officer has been penalized for this complaint and cannot be reassigned to it.', 400);
  }

  // Priority Lock for low reputation officers
  if (complaint.priorityHint === 'urgent' && officer.reputationScore < 50) {
    throw new AppError('This officer has a low reputation score and is barred from handling high-priority/urgent complaints.', 403);
  }

  complaint.department = req.body.department || officer.department;
  complaint.assignedTo = officer._id;
  complaint.status = 'ALLOCATED';
  complaint.statusHistory.push({
    status: 'ALLOCATED',
    note: req.body.note || `Assigned to ${officer.name}`,
    changedBy: req.user._id
  });
  await complaint.save();
  const promoted = await promoteNextOfficerComplaint(officer._id, req.user._id);
  if (promoted && promoted._id.equals(complaint._id)) {
    complaint.status = 'IN_PROGRESS';
  }

  await writeAudit({
    actor: req.user._id,
    action: 'COMPLAINT_ASSIGNED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { assignedTo: officer._id, department: complaint.department }
  });

  await createNotification({
    user: officer._id,
    type: 'complaint_assigned',
    title: 'Complaint assigned',
    message: `Complaint ${complaint.complaintId} has been assigned to you.`,
    relatedComplaint: complaint._id
  });

  return ok(res, 'Complaint assigned successfully', { complaint });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);

  if (req.user.role === 'officer' && !complaint.assignedTo?.equals(req.user._id)) {
    throw new AppError('You can update only assigned complaints', 403);
  }

  const resolutionImages = req.body.resolutionImages || [];
  const updated = await updateComplaintStatus({
    complaint,
    status: req.body.status,
    note: req.body.note,
    actor: req.user,
    resolutionImages
  });

  return ok(res, 'Complaint status updated', { complaint: updated });
});

export const rejectComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!['SUBMITTED', 'NEW', 'REOPENED', 'ESCALATED'].includes(complaint.status)) {
    throw new AppError('Only submitted complaints can be rejected', 400);
  }

  complaint.status = 'REJECTED';
  complaint.statusHistory.push({
    status: 'REJECTED',
    note: req.body.note || 'Complaint rejected by supervisor',
    changedBy: req.user._id
  });
  await complaint.save();
  await writeAudit({
    actor: req.user._id,
    action: 'COMPLAINT_REJECTED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { note: req.body.note }
  });

  return ok(res, 'Complaint rejected', { complaint });
});

export const requestCompletion = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!complaint.assignedTo?.equals(req.user._id)) throw new AppError('You can complete only your active complaint', 403);
  if (complaint.status !== 'IN_PROGRESS') throw new AppError('Only the active complaint can be sent for completion approval', 400);

  const resolutionImages = req.body.resolutionImages || [];
  if (!resolutionImages.length) throw new AppError('Completion proof photograph is required', 422);

  const afterImage = resolutionImages[0];
  let afterBuffer;

  // 1. Fetch image from Cloudinary to verify EXIF
  try {
    const response = await axios.get(afterImage.secure_url, { responseType: 'arraybuffer' });
    afterBuffer = Buffer.from(response.data);
    const parser = exifParser.create(afterBuffer);
    const result = parser.parse();

    if (result.tags) {
      const { DateTimeOriginal, GPSLatitude, GPSLongitude } = result.tags;
      
      const assignmentEvent = complaint.statusHistory.find(h => h.status === 'ALLOCATED' || h.status === 'ASSIGNED');
      const assignmentDate = assignmentEvent ? assignmentEvent.changedAt : complaint.createdAt;

      // EXIF validation: Check if photo was taken after assignment
      if (DateTimeOriginal && DateTimeOriginal * 1000 < assignmentDate.getTime()) {
        console.warn('Photo was taken before the complaint was assigned. New proof is required.');
      }

      // EXIF validation: Check location
      if (GPSLatitude && GPSLongitude) {
        const [complaintLon, complaintLat] = complaint.location.coordinates.coordinates;
        const dist = getDistance(GPSLatitude, GPSLongitude, complaintLat, complaintLon);
        if (dist > 50) {
          console.warn(`Photo taken too far (${Math.round(dist)}m) from complaint location. Proof must be taken at the site.`);
        }
      } else {
        console.warn('Resolution photo lacks GPS metadata. Location verification is mandatory.');
      }
    } else {
      console.warn('Could not read metadata from resolution photo. Please upload an original photograph.');
    }
  } catch (err) {
    console.error('EXIF parse error:', err.message);
  }

  // 2. AI Verification
  if (complaint.images.length > 0) {
    let aiResult = null;
    try {
      const beforeImage = complaint.images[0];
      const beforeRes = await axios.get(beforeImage.secure_url, { responseType: 'arraybuffer' });
      const beforeBuffer = Buffer.from(beforeRes.data);

      aiResult = await verifyResolutionWithAI(beforeBuffer, afterBuffer);
      console.log(`AI Verification for ${complaint.complaintId}: Score=${aiResult.match_score}, Verified=${aiResult.verified}, Msg=${aiResult.message}`);
      
      if (!aiResult.verified) {
         throw new AppError(`AI Verification Failed: ${aiResult.message} (Score: ${aiResult.match_score.toFixed(2)})`, 400);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error('AI Verification service error:', err.message);
      throw new AppError('AI Verification service is currently unavailable. Please try again later.', 503);
    }
    
    if (aiResult) {
      complaint.aiVerification = {
        score: aiResult.match_score,
        verified: aiResult.verified,
        message: aiResult.message
      };
    }
  }
  complaint.status = 'PENDING_VERIFICATION'; 
  complaint.completionRequestedAt = new Date();
  complaint.resolutionImages = resolutionImages;

  complaint.statusHistory.push({
    status: 'PENDING_VERIFICATION',
    note: req.body.note || 'Officer requested closure after completing work. Waiting for Citizen/Audit verification.',
    changedBy: req.user._id
  });
  await complaint.save();

  await writeAudit({
    actor: req.user._id,
    action: 'COMPLAINT_COMPLETION_REQUESTED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { proofCount: resolutionImages.length }
  });

  return ok(res, 'Completion request sent for verification', { complaint });
});

export const reviewCompletion = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!['PENDING_COMPLETION', 'PENDING_VERIFICATION'].includes(complaint.status)) throw new AppError('Complaint is not awaiting completion review', 400);

  const approved = req.body.decision === 'approve';
  complaint.status = approved ? 'CLOSED' : 'IN_PROGRESS';
  complaint.completionReviewedAt = new Date();
  complaint.completedInTime = approved ? complaint.completionRequestedAt <= complaint.dueAt : complaint.completedInTime;
  if (approved) complaint.closedAt = new Date();
  if (!approved) complaint.completionRejectedAt = new Date();
  complaint.statusHistory.push({
    status: complaint.status,
    note: req.body.note || (approved ? 'Completion approved and complaint closed' : 'Completion proof rejected by supervisor'),
    changedBy: req.user._id
  });
  await complaint.save();

  await writeAudit({
    actor: req.user._id,
    action: approved ? 'COMPLAINT_COMPLETION_APPROVED' : 'COMPLAINT_COMPLETION_REJECTED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { decision: req.body.decision, note: req.body.note }
  });

  if (approved && complaint.assignedTo) {
    await promoteNextOfficerComplaint(complaint.assignedTo, req.user._id);
  }

  return ok(res, approved ? 'Complaint closed' : 'Completion request rejected', { complaint });
});

export const vetoResolution = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizen: req.user._id });
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (complaint.status !== 'PENDING_VERIFICATION') {
    throw new AppError('Only pending verification complaints can be vetoed', 400);
  }

  complaint.vetoed = true;
  complaint.status = 'PENDING_AUDIT';
  complaint.statusHistory.push({
    status: 'PENDING_AUDIT',
    note: 'Citizen vetoed the resolution. Assigning to independent auditors.',
    changedBy: req.user._id
  });

  const potentialAuditors = await User.aggregate([
    { $match: { 
      reputationScore: { $gt: 150 }, 
      _id: { $ne: req.user._id },
      isActive: true
    } },
    { $sample: { size: 3 } }
  ]);

  if (potentialAuditors.length < 3) {
    const fallbackAuditors = await User.aggregate([
      { $match: { 
        role: { $in: ['citizen', 'supervisor'] }, 
        _id: { $ne: req.user._id },
        isActive: true,
        _id: { $nin: potentialAuditors.map(a => a._id) }
      } },
      { $sample: { size: 3 - potentialAuditors.length } }
    ]);
    potentialAuditors.push(...fallbackAuditors);
  }

  const dueDate = new Date(Date.now() + 36 * 60 * 60 * 1000);
  complaint.auditors = potentialAuditors.map(u => ({
    auditor: u._id,
    stakedPoints: 10,
    assignedAt: new Date(),
    dueDate: dueDate
  }));

  await complaint.save();

  // Notify auditors
  for (const a of complaint.auditors) {
    await createNotification({
      user: a.auditor,
      type: 'audit_requested',
      title: 'Audit duty assigned',
      message: `You have been selected as an independent auditor for complaint ${complaint.complaintId}. Your vote is required within 36 hours.`,
      relatedComplaint: complaint._id
    });
  }

  return ok(res, 'Veto submitted and auditors assigned', { complaint });
});

export const assignNextAuditor = async (complaintId, tardyAuditorId) => {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return;

  const tardyAuditor = await User.findById(tardyAuditorId);
  if (tardyAuditor) {
    tardyAuditor.reputationScore -= 20;
    await tardyAuditor.save();
  }

  complaint.rejectedAuditors.push(tardyAuditorId);
  complaint.auditors = complaint.auditors.filter(a => !a.auditor.equals(tardyAuditorId));

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
    // Fallback
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
    await createNotification({
      user: null, // Admin/Supervisor
      type: 'audit_fallback',
      title: 'No auditors available',
      message: `Complaint ${complaint.complaintId} requires manual supervisor approval as no auditors are available.`,
      relatedComplaint: complaint._id
    });
  }

  await complaint.save();
};

export const submitAuditVote = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (complaint.status !== 'PENDING_AUDIT') throw new AppError('Complaint is not in audit state', 400);

  const auditorEntry = complaint.auditors.find(a => a.auditor.equals(req.user._id));
  if (!auditorEntry) throw new AppError('You are not assigned as an auditor for this complaint', 403);
  if (auditorEntry.vote) throw new AppError('You have already voted', 400);

  auditorEntry.vote = req.body.vote;
  auditorEntry.votedAt = new Date();
  
  await complaint.save();

  // Check if all auditors voted
  const allVoted = complaint.auditors.every(a => a.vote);
  if (allVoted) {
    const approveVotes = complaint.auditors.filter(a => a.vote === 'approve').length;
    const rejectVotes = complaint.auditors.filter(a => a.vote === 'reject').length;

    const approved = approveVotes > rejectVotes;

    complaint.status = approved ? 'CLOSED' : 'IN_PROGRESS';
    complaint.statusHistory.push({
      status: complaint.status,
      note: `Audit concluded. Majority ${approved ? 'APPROVED' : 'REJECTED'}.`,
      changedBy: req.user._id
    });

    if (approved) complaint.closedAt = new Date();

    // Trust Engine logic
    const officer = await User.findById(complaint.assignedTo);
    const citizen = await User.findById(complaint.citizen);

    if (approved) {
      // Resolution was valid, citizen veto was wrong
      if (officer) { officer.reputationScore += 10; await officer.save(); }
      if (citizen) { citizen.reputationScore -= 50; await citizen.save(); }
    } else {
      // Resolution was invalid, officer faked it
      if (officer) { officer.reputationScore -= 50; await officer.save(); }
      if (citizen) { citizen.reputationScore += 10; await citizen.save(); }
      
      complaint.vetoCount += 1;
      await escalateComplaint(complaint);
    }

    // Reward correct auditors
    for (const a of complaint.auditors) {
      const auditorUser = await User.findById(a.auditor);
      if (auditorUser) {
        if ((approved && a.vote === 'approve') || (!approved && a.vote === 'reject')) {
          auditorUser.reputationScore += a.stakedPoints * 2;
          auditorUser.civicPoints += a.stakedPoints * 2;
        } else {
          auditorUser.reputationScore -= a.stakedPoints;
        }
        await auditorUser.save();
      }
    }

    await complaint.save();
  }

  return ok(res, 'Audit vote recorded', { complaint });
});

export const extendDeadline = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (['CLOSED', 'REJECTED'].includes(complaint.status)) throw new AppError('Closed or rejected complaints cannot be extended', 400);

  const hours = Number(req.body.hours);
  complaint.dueAt = new Date(complaint.dueAt.getTime() + hours * 60 * 60 * 1000);
  complaint.deadlineExtendedAt = new Date();
  complaint.deadlineExtensionCount += 1;
  complaint.statusHistory.push({
    status: complaint.status,
    note: req.body.note || `Deadline extended by ${hours} hours`,
    changedBy: req.user._id
  });
  await complaint.save();

  await writeAudit({
    actor: req.user._id,
    action: 'COMPLAINT_DEADLINE_EXTENDED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { hours, dueAt: complaint.dueAt }
  });

  return ok(res, 'Deadline extended', { complaint });
});

export const submitFeedback = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizen: req.user._id });
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!['CLOSED', 'VERIFIED', 'PENDING_VERIFICATION'].includes(complaint.status)) {
    throw new AppError('Feedback can be submitted only after the resolution is provided.', 400);
  }

  if (complaint.status === 'PENDING_VERIFICATION') {
    complaint.status = 'CLOSED';
    complaint.closedAt = new Date();
    complaint.statusHistory.push({
      status: 'CLOSED',
      note: 'Complaint closed by citizen with feedback.',
      changedBy: req.user._id
    });
  }

  complaint.feedback = {
    rating: req.body.rating,
    comment: req.body.comment,
    submittedAt: new Date()
  };
  await complaint.save();

  await writeAudit({
    actor: req.user._id,
    action: 'COMPLAINT_FEEDBACK_SUBMITTED',
    entityType: 'Complaint',
    entityId: complaint._id,
    metadata: { rating: req.body.rating }
  });

  return ok(res, 'Feedback submitted', { complaint });
});

export const escalateOverdue = asyncHandler(async (req, res) => {
  const modified = await flagOverdueComplaints(req.user._id);
  return ok(res, 'Overdue complaints escalated', { modified });
});

export const dashboardMetrics = asyncHandler(async (req, res) => {
  let roleQuery = complaintQueryForRole(req.user);
  let targetUser = req.user;
  if (req.user.role === 'admin' && req.query.staffId) {
    const staff = await User.findById(req.query.staffId);
    if (!staff) throw new AppError('Staff member not found', 404);
    targetUser = staff;
    roleQuery = staff.role === 'officer' ? { assignedTo: staff._id } : staff.department ? { department: staff.department } : {};
  }
  const baseMatch = {};
  for (const [key, value] of Object.entries(roleQuery)) {
    if (key === '$or') {
      baseMatch.$or = value.map(cond => {
        const mapped = {};
        for (const [ck, cv] of Object.entries(cond)) {
          mapped[ck] = mongoose.isValidObjectId(cv) ? new mongoose.Types.ObjectId(cv) : cv;
        }
        return mapped;
      });
    } else {
      baseMatch[key] = mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : value;
    }
  }

  const [byCategory, byStatus, monthly, overdueCount, total, activeComplaint, pendingComplaints, completedCount, onTimeCount, lateCount, submittedCount, allocatedCount, completionRequestCount, auditingComplaints, pendingCount] = await Promise.all([
    Complaint.aggregate([{ $match: baseMatch }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: baseMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.aggregate([
      { $match: baseMatch },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Complaint.countDocuments({ ...roleQuery, dueAt: { $lt: new Date() }, status: { $nin: ['CLOSED', 'RESOLVED', 'VERIFIED'] } }),
    Complaint.countDocuments(roleQuery),
    targetUser.role === 'officer' ? Complaint.findOne({ assignedTo: targetUser._id, status: 'IN_PROGRESS' }).sort({ createdAt: 1 }) : null,
    Complaint.find(roleQueryForPending(targetUser, roleQuery)).populate('citizen', 'name email').populate('assignedTo', 'name email').sort({ createdAt: 1 }).limit(20),
    Complaint.countDocuments({ ...roleQuery, status: 'CLOSED' }),
    Complaint.countDocuments({ ...roleQuery, status: 'CLOSED', completedInTime: true }),
    Complaint.countDocuments({ ...roleQuery, status: 'CLOSED', completedInTime: false }),
    Complaint.countDocuments({ ...roleQuery, status: { $in: ['SUBMITTED', 'NEW'] } }),
    Complaint.countDocuments({ ...roleQuery, status: { $in: ['ALLOCATED', 'ASSIGNED', 'IN_PROGRESS'] } }),
    Complaint.countDocuments({ ...roleQuery, status: { $in: ['PENDING_COMPLETION', 'PENDING_VERIFICATION', 'PENDING_AUDIT'] } }),
    targetUser.role === 'citizen' ? Complaint.find({ 'auditors.auditor': targetUser._id, status: 'PENDING_AUDIT' }).limit(10) : null,
    Complaint.countDocuments(roleQueryForPending(targetUser, roleQuery))
  ]);

  return ok(res, 'Dashboard metrics fetched', {
    total,
    overdueCount,
    slaBreachRate: total ? Math.round((overdueCount / total) * 100) : 0,
    byCategory,
    byStatus,
    monthly,
    activeComplaint,
    pendingComplaints,
    completedCount,
    onTimeCount,
    lateCount,
    submittedCount,
    allocatedCount,
    completionRequestCount,
    auditingComplaints,
    pendingCount
  });
});

const roleQueryForPending = (user, roleQuery) => {
  const pendingStatuses = ['SUBMITTED', 'NEW', 'ALLOCATED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_COMPLETION', 'PENDING_VERIFICATION', 'PENDING_AUDIT'];
  if (user.role === 'officer') return { assignedTo: user._id, status: { $in: ['ALLOCATED', 'ASSIGNED'] } };
  if (user.role === 'supervisor') return { ...roleQuery, status: { $in: ['SUBMITTED', 'NEW', 'PENDING_COMPLETION', 'PENDING_VERIFICATION', 'PENDING_AUDIT'] } };
  return { ...roleQuery, status: { $in: pendingStatuses } };
};
