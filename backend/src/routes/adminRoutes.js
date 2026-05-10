import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createDepartment,
  createStaffUser,
  listAuditLogs,
  listDepartments,
  listUsers,
  updateDepartment,
  updateUser,
  getLeaderboards
} from '../controllers/adminController.js';
import { authorize, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';

export const adminRoutes = Router();

adminRoutes.use(protect);

adminRoutes.get('/departments', listDepartments);

adminRoutes.post(
  '/departments',
  authorize('admin'),
  [body('name').trim().isLength({ min: 2, max: 80 }), body('code').trim().isLength({ min: 2, max: 20 }), body('description').optional().trim()],
  validate,
  createDepartment
);

adminRoutes.patch(
  '/departments/:id',
  authorize('admin'),
  [param('id').isMongoId(), body('name').optional().trim().isLength({ min: 2, max: 80 }), body('code').optional().trim().isLength({ min: 2, max: 20 })],
  validate,
  updateDepartment
);

adminRoutes.get('/users', authorize('supervisor', 'admin'), listUsers);

adminRoutes.post(
  '/users',
  authorize('admin'),
  [
    body('name').trim().isLength({ min: 2, max: 80 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('password').isStrongPassword({ minLength: 8, minSymbols: 0 }),
    body('role').isIn(ROLES.filter((role) => role !== 'citizen')),
    body('department').optional({ checkFalsy: true }).isMongoId()
  ],
  validate,
  createStaffUser
);

adminRoutes.patch(
  '/users/:id',
  authorize('admin'),
  [param('id').isMongoId(), body('role').optional().isIn(ROLES), body('department').optional({ nullable: true, checkFalsy: true }).isMongoId()],
  validate,
  updateUser
);

adminRoutes.get('/leaderboards', getLeaderboards);

adminRoutes.get('/audit-logs', authorize('admin'), listAuditLogs);
