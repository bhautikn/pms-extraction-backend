import { Request, Response, NextFunction } from 'express';
import * as extractionService from '../services/extraction.service';
import { sendSuccess, sendError } from '../utils/response';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

export async function uploadPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, MESSAGES.PDF_REQUIRED, HTTP_STATUS.BAD_REQUEST);
      return;
    }
    if (!req.user.settings?.anthropicApiKey) {
      sendError(res, MESSAGES.NO_API_KEY, HTTP_STATUS.BAD_REQUEST);
      return;
    }
    const { extractionId } = await extractionService.createExtraction(req.user, req.file);
    sendSuccess(res, MESSAGES.EXTRACTION_STARTED, { extractionId }, HTTP_STATUS.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function listExtractions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const data = await extractionService.getExtractions(req.user._id, page, limit);
    sendSuccess(res, 'Extractions fetched', data);
  } catch (err) {
    next(err);
  }
}

export async function getExtraction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    // IDOR protection: userId scoped inside service
    const extraction = await extractionService.getExtractionById(id, req.user._id);
    if (!extraction) {
      sendError(res, MESSAGES.EXTRACTION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      return;
    }
    sendSuccess(res, 'Extraction fetched', extraction);
  } catch (err) {
    next(err);
  }
}

export async function retryExtraction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { extractionId } = await extractionService.retryExtraction(id, req.user);
    sendSuccess(res, MESSAGES.EXTRACTION_STARTED, { extractionId }, HTTP_STATUS.OK);
  } catch (err) {
    next(err);
  }
}
