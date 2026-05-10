import { Router } from 'express';
import { body } from 'express-validator';
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
  updateProfile
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const authRoutes = Router();

authRoutes.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 80 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('password').isStrongPassword({ minLength: 8, minSymbols: 0 })
  ],
  validate,
  register
);

authRoutes.post('/login', [body('email').isEmail().normalizeEmail(), body('password').notEmpty()], validate, login);
authRoutes.post('/refresh', [body('refreshToken').notEmpty()], validate, refresh);
authRoutes.post('/logout', protect, logout);
authRoutes.get('/me', protect, me);
authRoutes.patch('/profile', protect, updateProfile);
authRoutes.post('/forgot-password', [body('email').isEmail().normalizeEmail()], validate, forgotPassword);
authRoutes.post(
  '/reset-password',
  [body('token').notEmpty(), body('password').isStrongPassword({ minLength: 8, minSymbols: 0 })],
  validate,
  resetPassword
);
