import { Types } from 'mongoose';
import { ExtractionModel } from '../models/extraction.model';
import { ExtractionStatus } from '../enums/extractionStatus.enum';
import { uploadPdfToBlob, downloadPdfFromBlob } from './azure.service';
import { extractFromPdf } from './claude.service';
import { decrypt } from '../utils/encrypt';
import { IUser } from '../models/user.model';

export async function createExtraction(
  user: IUser,
  file: Express.Multer.File,
): Promise<{ extractionId: string }> {
  // 1. Upload PDF to Azure Blob
  const pdfUrl = await uploadPdfToBlob(file.buffer, file.originalname);

  // 2. Create pending extraction record
  const extraction = await ExtractionModel.create({
    userId: user._id,
    filename: file.originalname,
    pdfUrl,
    status: ExtractionStatus.PROCESSING,
  });

  // 3. Kick off async Claude processing (fire-and-forget, update record when done)
  (async () => {
    try {
      const encryptedKey = user.settings?.anthropicApiKey;
      if (!encryptedKey) throw new Error('No API key configured');

      const apiKey = decrypt(encryptedKey);
      const model = user.settings?.claudeModel ?? 'claude-opus-4-7';

      const result = await extractFromPdf(file.buffer, apiKey, model);

      let parsedResult: Record<string, unknown>;
      try {
        parsedResult = JSON.parse(result.text);
      } catch {
        throw new Error('Claude returned invalid JSON');
      }

      await ExtractionModel.findByIdAndUpdate(extraction._id, {
        status: ExtractionStatus.COMPLETED,
        result: parsedResult,
        tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await ExtractionModel.findByIdAndUpdate(extraction._id, {
        status: ExtractionStatus.FAILED,
        errorMessage: message,
      });
    }
  })();

  return { extractionId: extraction._id.toString() };
}

export async function getExtractions(userId: Types.ObjectId, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [extractions, total] = await Promise.all([
    ExtractionModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-result') // exclude large result from list view
      .lean(),
    ExtractionModel.countDocuments({ userId }),
  ]);
  return { extractions, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getExtractionById(id: string, userId: Types.ObjectId) {
  const extraction = await ExtractionModel.findOne({ _id: id, userId }).lean();
  return extraction ?? null;
}

export async function retryExtraction(
  id: string,
  user: IUser
): Promise<{ extractionId: string }> {
  const extraction = await ExtractionModel.findOne({ _id: id, userId: user._id });
  if (!extraction) throw new Error('Extraction not found');
  if (extraction.status !== ExtractionStatus.FAILED) throw new Error('Can only retry failed extractions');

  // Reset status
  extraction.status = ExtractionStatus.PROCESSING;
  extraction.errorMessage = undefined;
  await extraction.save();

  // Kick off async processing again
  (async () => {
    try {
      const encryptedKey = user.settings?.anthropicApiKey;
      if (!encryptedKey) throw new Error('No API key configured');

      const apiKey = decrypt(encryptedKey);
      const model = user.settings?.claudeModel ?? 'claude-opus-4-7';

      const pdfBuffer = await downloadPdfFromBlob(extraction.pdfUrl);

      const result = await extractFromPdf(pdfBuffer, apiKey, model);

      let parsedResult: Record<string, unknown>;
      try {
        parsedResult = JSON.parse(result.text);
      } catch {
        throw new Error('Claude returned invalid JSON');
      }

      await ExtractionModel.findByIdAndUpdate(extraction._id, {
        status: ExtractionStatus.COMPLETED,
        result: parsedResult,
        tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await ExtractionModel.findByIdAndUpdate(extraction._id, {
        status: ExtractionStatus.FAILED,
        errorMessage: message,
      });
    }
  })();

  return { extractionId: extraction._id.toString() };
}
