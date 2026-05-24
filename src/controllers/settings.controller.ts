import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model';
import { encrypt, decrypt, maskApiKey } from '../utils/encrypt';
import { sendSuccess, sendError } from '../utils/response';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

export async function getSettings(req: Request, _res: Response, next: NextFunction, res: Response): Promise<void> {
  try {
    const user = await UserModel.findById(req.user._id).select('+settings.anthropicApiKey').lean();
    if (!user) {
      sendError(res, MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      return;
    }
    const maskedKey = user.settings?.anthropicApiKey
      ? maskApiKey(decrypt(user.settings.anthropicApiKey))
      : null;

    sendSuccess(res, MESSAGES.SETTINGS_FETCHED, {
      anthropicApiKeySet: !!user.settings?.anthropicApiKey,
      anthropicApiKeyMasked: maskedKey,
      claudeModel: user.settings?.claudeModel ?? 'claude-opus-4-5',
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { anthropicApiKey, claudeModel } = req.body as {
      anthropicApiKey?: string;
      claudeModel?: string;
    };

    const update: Record<string, unknown> = {};
    if (anthropicApiKey) {
      update['settings.anthropicApiKey'] = encrypt(anthropicApiKey.trim());
    }
    if (claudeModel) {
      update['settings.claudeModel'] = claudeModel.trim();
    }

    await UserModel.findByIdAndUpdate(req.user._id, { $set: update });
    sendSuccess(res, MESSAGES.SETTINGS_UPDATED);
  } catch (err) {
    next(err);
  }
}
