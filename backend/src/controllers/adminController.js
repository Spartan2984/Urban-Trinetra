import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { writeAudit } from '../services/auditService.js';

const safeUserSelect = '-passwordHash -refreshTokenHash';

export const listUsers = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.department) query.department = req.query.department;

  const users = await User.find(query).select(safeUserSelect).populate('department', 'name code').sort({ createdAt: -1 });
  return ok(res, 'Users fetched', { users });
});

export const createStaffUser = asyncHandler(async (req, res) => {
  const existing = await User.findOne({ email: req.body.email });
  if (existing) throw new AppError('Email is already registered', 409);

  const user = new User({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    role: req.body.role,
    department: req.body.department || null
  });
  await user.setPassword(req.body.password);
  await user.save();

  await writeAudit({
    actor: req.user._id,
    action: 'STAFF_USER_CREATED',
    entityType: 'User',
    entityId: user._id,
    metadata: { role: user.role }
  });

  return ok(res, 'Staff user created', { user }, 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const fields = ['name', 'phone', 'role', 'department', 'isActive'];
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) user[field] = req.body[field];
  }
  await user.save();

  await writeAudit({
    actor: req.user._id,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: user._id,
    metadata: req.body
  });

  return ok(res, 'User updated', { user });
});

export const listDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  return ok(res, 'Departments fetched', { departments });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const department = await Department.create(req.body);
  await writeAudit({
    actor: req.user._id,
    action: 'DEPARTMENT_CREATED',
    entityType: 'Department',
    entityId: department._id,
    metadata: { code: department.code }
  });
  return ok(res, 'Department created', { department }, 201);
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!department) throw new AppError('Department not found', 404);

  await writeAudit({
    actor: req.user._id,
    action: 'DEPARTMENT_UPDATED',
    entityType: 'Department',
    entityId: department._id,
    metadata: req.body
  });

  return ok(res, 'Department updated', { department });
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .populate('actor', 'name email role')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit || 100), 200));
  return ok(res, 'Audit logs fetched', { logs });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .populate('relatedComplaint', 'status')
    .sort({ createdAt: -1 })
    .limit(50);
  return ok(res, 'Notifications fetched', { notifications });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new AppError('Notification not found', 404);
  return ok(res, 'Notification marked read', { notification });
});

export const getLeaderboards = asyncHandler(async (req, res) => {
  const [topAuditors, topOfficers, topSupervisors, bottomOfficers, bottomSupervisors] = await Promise.all([
    User.find({ role: 'citizen', reputationScore: { $gt: 100 } })
      .sort({ reputationScore: -1 })
      .limit(5)
      .select('name reputationScore profileImage'),
    User.find({ role: 'officer', reputationScore: { $gt: 100 } })
      .sort({ reputationScore: -1 })
      .limit(5)
      .select('name reputationScore profileImage email phone department')
      .populate('department', 'name'),
    User.find({ role: 'supervisor', reputationScore: { $gt: 100 } })
      .sort({ reputationScore: -1 })
      .limit(5)
      .select('name reputationScore profileImage email phone department')
      .populate('department', 'name'),
    User.find({ role: 'officer', reputationScore: { $lt: 100 } })
      .sort({ reputationScore: 1 })
      .limit(5)
      .select('name reputationScore profileImage email phone department')
      .populate('department', 'name'),
    User.find({ role: 'supervisor', reputationScore: { $lt: 100 } })
      .sort({ reputationScore: 1 })
      .limit(5)
      .select('name reputationScore profileImage email phone department')
      .populate('department', 'name')
  ]);

  // Add impact calculation for bottom boards
  const mapWithImpact = (users) => users.map(u => {
    const user = u.toObject();
    if (user.reputationScore < 50) {
      user.salaryImpact = '-15%';
      user.status = 'DISCIPLINARY_REVIEW';
    } else if (user.reputationScore < 0) {
      user.salaryImpact = '-30%';
      user.status = 'SUSPENSION_WARNING';
    }
    return user;
  });

  return ok(res, 'Leaderboards fetched', {
    topAuditors,
    topOfficers,
    topSupervisors,
    bottomOfficers: mapWithImpact(bottomOfficers),
    bottomSupervisors: mapWithImpact(bottomSupervisors)
  });
});
