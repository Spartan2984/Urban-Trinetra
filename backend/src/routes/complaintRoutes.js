import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  assignComplaint,
  changeStatus,
  createComplaint,
  dashboardMetrics,
  escalateOverdue,
  extendDeadline,
  getComplaint,
  listComplaints,
  rejectComplaint,
  requestCompletion,
  reviewCompletion,
  submitFeedback,
  getUploadSignature,
  vetoResolution,
  submitAuditVote
} from '../controllers/complaintController.js';
import { CATEGORIES, COMPLAINT_STATUSES } from '../models/Complaint.js';
import { authorize, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const complaintRoutes = Router();

complaintRoutes.use(protect);

complaintRoutes.get('/upload-signature', getUploadSignature);
complaintRoutes.get('/metrics', dashboardMetrics);
complaintRoutes.post('/escalate-overdue', authorize('supervisor', 'admin'), escalateOverdue);

complaintRoutes
  .route('/')
  .get(
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 50 }),
      query('category').optional().isIn(CATEGORIES),
      query('status').optional().isIn(COMPLAINT_STATUSES)
    ],
    validate,
    listComplaints
  )
  .post(
    authorize('citizen'),
    [
      body('category').isIn(CATEGORIES),
      body('title').trim().isLength({ min: 4, max: 120 }),
      body('description').trim().isLength({ min: 20, max: 2000 }),
      body('priorityHint').optional().isIn(['low', 'medium', 'high', 'urgent']),
      body('address').trim().isLength({ min: 5, max: 250 }),
      body('longitude').isFloat({ min: -180, max: 180 }),
      body('latitude').isFloat({ min: -90, max: 90 }),
      body('contactName').optional().trim().isLength({ max: 80 }),
      body('contactPhone').optional().trim().isLength({ max: 20 })
    ],
    validate,
    createComplaint
  );

complaintRoutes.get('/:id', [param('id').isMongoId()], validate, getComplaint);

complaintRoutes.patch(
  '/:id/assign',
  authorize('supervisor'),
  [param('id').isMongoId(), body('assignedTo').isMongoId(), body('department').optional({ checkFalsy: true }).isMongoId(), body('note').optional().trim()],
  validate,
  assignComplaint
);

complaintRoutes.patch(
  '/:id/reject',
  authorize('supervisor'),
  [param('id').isMongoId(), body('note').optional().trim().isLength({ max: 500 })],
  validate,
  rejectComplaint
);

complaintRoutes.patch(
  '/:id/request-completion',
  authorize('officer'),
  [param('id').isMongoId(), body('note').optional().trim().isLength({ max: 500 })],
  validate,
  requestCompletion
);

complaintRoutes.patch(
  '/:id/review-completion',
  authorize('supervisor'),
  [param('id').isMongoId(), body('decision').isIn(['approve', 'reject']), body('note').optional().trim().isLength({ max: 500 })],
  validate,
  reviewCompletion
);

complaintRoutes.patch(
  '/:id/extend-deadline',
  authorize('supervisor'),
  [param('id').isMongoId(), body('hours').isInt({ min: 1, max: 720 }), body('note').optional().trim().isLength({ max: 500 })],
  validate,
  extendDeadline
);

complaintRoutes.patch(
  '/:id/status',
  authorize('supervisor', 'admin'),
  [param('id').isMongoId(), body('status').isIn(COMPLAINT_STATUSES), body('note').optional().trim().isLength({ max: 500 })],
  validate,
  changeStatus
);

complaintRoutes.post(
  '/:id/feedback',
  authorize('citizen'),
  [param('id').isMongoId(), body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim().isLength({ max: 500 })],
  validate,
  submitFeedback
);

complaintRoutes.post(
  '/:id/veto',
  authorize('citizen'),
  [param('id').isMongoId()],
  validate,
  vetoResolution
);

complaintRoutes.post(
  '/:id/audit',
  authorize('citizen', 'officer', 'supervisor', 'admin'),
  [param('id').isMongoId(), body('vote').isIn(['approve', 'reject'])],
  validate,
  submitAuditVote
);
