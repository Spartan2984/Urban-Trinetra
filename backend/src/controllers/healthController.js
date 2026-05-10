import mongoose from 'mongoose';
import { ok } from '../utils/apiResponse.js';

export const health = (req, res) => {
  return ok(res, 'API is healthy', {
    uptime: process.uptime(),
    mongoState: mongoose.connection.readyState
  });
};
