import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const signAccessToken = (user) => {
  return jwt.sign({ sub: user._id, role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenExpiresIn
  });
};

export const signRefreshToken = (user) => {
  return jwt.sign({ sub: user._id, tokenVersion: user.tokenVersion }, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenExpiresIn
  });
};

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const signResetToken = (user) => {
  return jwt.sign({ sub: user._id, purpose: 'password-reset' }, env.jwtResetSecret, {
    expiresIn: '15m'
  });
};
