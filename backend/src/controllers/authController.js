import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { hashToken, signAccessToken, signRefreshToken, signResetToken } from '../utils/tokens.js';
import { sendEmail } from '../services/notificationService.js';
import { writeAudit } from '../services/auditService.js';

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  department: user.department,
  profileImage: user.profileImage
});

const issueTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
};

export const register = asyncHandler(async (req, res) => {
  const existing = await User.findOne({ email: req.body.email });
  if (existing) throw new AppError('Email is already registered', 409);

  const user = new User({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    role: 'citizen'
  });
  await user.setPassword(req.body.password);
  await user.save();

  const tokens = await issueTokens(user);
  await writeAudit({ actor: user._id, action: 'USER_REGISTERED', entityType: 'User', entityId: user._id });

  return ok(res, 'Registration successful', { user: publicUser(user), ...tokens }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash +refreshTokenHash');
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) throw new AppError('Account is inactive', 403);

  const tokens = await issueTokens(user);
  await writeAudit({ actor: user._id, action: 'USER_LOGIN', entityType: 'User', entityId: user._id });

  return ok(res, 'Login successful', { user: publicUser(user), ...tokens });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token is required', 400);

  const payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  const user = await User.findById(payload.sub).select('+refreshTokenHash');

  if (!user || user.tokenVersion !== payload.tokenVersion || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError('Invalid refresh token', 401);
  }

  const tokens = await issueTokens(user);
  return ok(res, 'Token refreshed', { user: publicUser(user), ...tokens });
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshTokenHash: 1 }, $inc: { tokenVersion: 1 } });
  await writeAudit({ actor: req.user._id, action: 'USER_LOGOUT', entityType: 'User', entityId: req.user._id });
  return ok(res, 'Logged out successfully');
});

export const me = asyncHandler(async (req, res) => {
  return ok(res, 'Current user fetched', { user: publicUser(req.user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const resetToken = signResetToken(user);
    const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Urban Trinetra password reset',
      text: `Use this link within 15 minutes to reset your password: ${resetUrl}`
    });
    console.log(`Password reset link for ${user.email}: ${resetUrl}`);
  }

  return ok(res, 'If the email exists, a password reset link has been sent');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const payload = jwt.verify(req.body.token, env.jwtResetSecret);
  if (payload.purpose !== 'password-reset') throw new AppError('Invalid reset token', 400);

  const user = await User.findById(payload.sub);
  if (!user) throw new AppError('Invalid reset token', 400);

  await user.setPassword(req.body.password);
  user.tokenVersion += 1;
  user.refreshTokenHash = undefined;
  await user.save();

  await writeAudit({ actor: user._id, action: 'PASSWORD_RESET', entityType: 'User', entityId: user._id });
  return ok(res, 'Password reset successful');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, profileImage } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (profileImage) user.profileImage = profileImage;

  await user.save();
  return ok(res, 'Profile updated', { user: publicUser(user) });
});
