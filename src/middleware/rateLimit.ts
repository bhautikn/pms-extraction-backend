import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, MESSAGES.RATE_LIMITED, HTTP_STATUS.TOO_MANY_REQUESTS),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, MESSAGES.RATE_LIMITED, HTTP_STATUS.TOO_MANY_REQUESTS),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, MESSAGES.RATE_LIMITED, HTTP_STATUS.TOO_MANY_REQUESTS),
});
