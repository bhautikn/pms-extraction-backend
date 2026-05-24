import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';
import { env } from '../config/env';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[Error]', err.message, err.stack);

  const message =
    env.NODE_ENV === 'production' ? MESSAGES.SERVER_ERROR : err.message || MESSAGES.SERVER_ERROR;

  sendError(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
}
