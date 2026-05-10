import { Router } from 'express';
import { param } from 'express-validator';
import { listNotifications, markNotificationRead } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const notificationRoutes = Router();

notificationRoutes.use(protect);
notificationRoutes.get('/', listNotifications);
notificationRoutes.patch('/:id/read', [param('id').isMongoId()], validate, markNotificationRead);
