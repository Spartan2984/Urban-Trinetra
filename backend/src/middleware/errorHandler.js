import { fail } from '../utils/apiResponse.js';

export const notFound = (req, res) => {
  return fail(res, `Route not found: ${req.originalUrl}`, [], 404);
};

export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error(err);
  }

  return fail(res, message, err.errors || [], status);
};
