import { Response } from 'express';
import { HTTP_STATUS, HttpStatusCode } from '../constants/httpStatus';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: HttpStatusCode = HTTP_STATUS.OK,
): Response {
  const body: ApiResponse<T> = { success: true, message };
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  errors?: unknown,
): Response {
  const body: ApiResponse = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
}
