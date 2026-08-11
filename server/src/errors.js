/** Error types and the Express error handler. */
import { logger } from './logger.js';

export class AppError extends Error {
  /**
   * @param {string} message human-readable, safe to speak aloud to a user
   * @param {number} status HTTP status code
   * @param {string} code stable machine code for the frontend
   * @param {object} [details]
   */
  constructor(message, status = 500, code = 'internal_error', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(message, 400, 'bad_request', details);
export const notFound = (message = 'Not found') => new AppError(message, 404, 'not_found');
export const upstreamError = (message, details) =>
  new AppError(message, 502, 'upstream_error', details);

/** Wraps an async route handler so rejections reach the error middleware. */
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/* eslint-disable no-unused-vars */
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed:`, err.stack || err.message);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status}: ${err.message}`);
  }
  res.status(status).json({
    error: {
      code: err.code || 'internal_error',
      message: err.message || 'Unexpected error',
      details: err.details,
    },
  });
}
