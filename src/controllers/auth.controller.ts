import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendError(res, MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, errors.array());
      return;
    }
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const { token, user } = await authService.signup(name, email, password);
    sendSuccess(res, MESSAGES.SIGNUP_SUCCESS, { token, user }, HTTP_STATUS.CREATED);
  } catch (err) {
    const message = err instanceof Error ? err.message : MESSAGES.SERVER_ERROR;
    if (message === MESSAGES.EMAIL_EXISTS) {
      sendError(res, message, HTTP_STATUS.CONFLICT);
    } else {
      next(err);
    }
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendError(res, MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, errors.array());
      return;
    }
    const { email, password, rememberMe } = req.body as { email: string; password: string; rememberMe?: boolean };
    const { token, user } = await authService.login(email, password, !!rememberMe);
    sendSuccess(res, MESSAGES.LOGIN_SUCCESS, { token, user });
  } catch (err) {
    const message = err instanceof Error ? err.message : MESSAGES.SERVER_ERROR;
    if (message === MESSAGES.INVALID_CREDENTIALS) {
      sendError(res, message, HTTP_STATUS.UNAUTHORIZED);
    } else {
      next(err);
    }
  }
}

export function me(req: Request, res: Response): void {
  sendSuccess(res, 'User fetched', req.user);
}
