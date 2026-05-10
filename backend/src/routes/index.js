import { Router } from 'express';
import { adminRoutes } from './adminRoutes.js';
import { authRoutes } from './authRoutes.js';
import { complaintRoutes } from './complaintRoutes.js';
import { forumRoutes } from './forumRoutes.js';
import { notificationRoutes } from './notificationRoutes.js';
import { health } from '../controllers/healthController.js';

export const apiRoutes = Router();

apiRoutes.get('/health', health);
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/complaints', complaintRoutes);
apiRoutes.use('/forum', forumRoutes);
apiRoutes.use('/admin', adminRoutes);
apiRoutes.use('/notifications', notificationRoutes);
