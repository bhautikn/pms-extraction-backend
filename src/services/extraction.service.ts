import { Types } from 'mongoose';
import { ExtractionModel } from '../models/extraction.model';
import { ExtractionStatus } from '../enums/extractionStatus.enum';
import { uploadPdfToBlob, downloadPdfFromBlob } from './azure.service';
import { extractFromPdf, ClaudeResult } from './claude.service';
import { decrypt } from '../utils/encrypt';
import { extractJson } from '../utils/extractJson';
import { IUser } from '../models/user.model';
import { getPdfPageCount, splitPdf } from '../utils/pdfSplit';
import { findSplitPoint } from './splitFinder.service';

const LARGE_PDF_THRESHOLD = 400; // pages
const SPLIT_TARGET_PAGE = 200;   // approximate midpoint for splitting

/**
 * Merge the ship_systems from a second extraction result into the first.
 * This ADDS new systems — it does not override existing ones.
 */
function mergeResults(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const existingSystems = (existing as any).ship_systems || [];
  const incomingSystems = (incoming as any).ship_systems || [];
  return {
    ...existing,
    ship_systems: [...existingSystems, ...incomingSystems],
  };
}

export async function createExtraction(
  user: IUser,
  file: Express.Multer.File,
): Promise<{ extractionId: string }> {
  // 0. Validate API Key before anything else
  const encryptedKey = user.settings?.anthropicApiKey;
  if (!encryptedKey) throw new Error('Before processing, you need to provide an Anthropic API Key in Settings.');
  
  let apiKey: string;
  try {
    apiKey = decrypt(encryptedKey);
  } catch (err) {
    throw new Error('Your Anthropic API Key is invalid or corrupted. Please update it in Settings before processing.');
  }

  // 1. Upload PDF to Azure Blob
  const pdfUrl = await uploadPdfToBlob(file.buffer, file.originalname);

  // 2. Create pending extraction record
  const extraction = await ExtractionModel.create({
    userId: user._id,
    filename: file.originalname,
    pdfUrl,
    status: ExtractionStatus.PROCESSING,
  });

  // 3. Kick off async processing (fire-and-forget)
  (async () => {
    try {
      const model = user.settings?.claudeModel ?? 'claude-opus-4-8';
      const pageCount = await getPdfPageCount(file.buffer);

      if (pageCount > LARGE_PDF_THRESHOLD) {
        // ── Large PDF: Split and process in two parts ──
        console.log(`[Split] PDF has ${pageCount} pages (>${LARGE_PDF_THRESHOLD}). Finding optimal split point...`);

        // Use Sonnet to find where a new component starts near page 200
        const splitPage = await findSplitPoint(file.buffer, SPLIT_TARGET_PAGE, apiKey);
        console.log(`[Split] Splitting at page ${splitPage}`);

        // Split the PDF into two halves
        const { part1, part2 } = await splitPdf(file.buffer, splitPage);
        console.log(`[Split] Part 1: ${splitPage} pages, Part 2: ${pageCount - splitPage} pages`);

        // Process Part 1
        console.log('[Split] Processing Part 1...');
        const result1 = await extractFromPdf(part1, apiKey, model);

        const parsedResult1 = extractJson(result1.text);

        // Save Part 1 result immediately
        await ExtractionModel.findByIdAndUpdate(extraction._id, {
          result: parsedResult1,
          tokenUsage: { inputTokens: result1.inputTokens, outputTokens: result1.outputTokens },
        });
        console.log('[Split] Part 1 saved. Processing Part 2...');

        // Process Part 2
        const result2 = await extractFromPdf(part2, apiKey, model);

        const parsedResult2 = extractJson(result2.text);

        // Merge Part 2 into existing Part 1 result (additive, not override)
        const mergedResult = mergeResults(parsedResult1, parsedResult2);

        await ExtractionModel.findByIdAndUpdate(extraction._id, {
          status: ExtractionStatus.COMPLETED,
          result: mergedResult,
          tokenUsage: {
            inputTokens: result1.inputTokens + result2.inputTokens,
            outputTokens: result1.outputTokens + result2.outputTokens,
          },
        });
        console.log('[Split] Both parts processed and merged successfully.');

      } else {
        // ── Normal PDF: Single-pass processing ──
        const result = await extractFromPdf(file.buffer, apiKey, model);

        const parsedResult = extractJson(result.text);

        await ExtractionModel.findByIdAndUpdate(extraction._id, {
          status: ExtractionStatus.COMPLETED,
          result: parsedResult,
          tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
        });
      }
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

  // 0. Validate API Key before anything else
  const encryptedKey = user.settings?.anthropicApiKey;
  if (!encryptedKey) throw new Error('Before processing, you need to provide an Anthropic API Key in Settings.');
  
  let apiKey: string;
  try {
    apiKey = decrypt(encryptedKey);
  } catch (err) {
    throw new Error('Your Anthropic API Key is invalid or corrupted. Please update it in Settings before processing.');
  }

  // Reset status
  extraction.status = ExtractionStatus.PROCESSING;
  extraction.errorMessage = undefined;
  extraction.result = undefined;
  await extraction.save();

  // Kick off async processing again
  (async () => {
    try {
      const model = user.settings?.claudeModel ?? 'claude-opus-4-8';
      const pdfBuffer = await downloadPdfFromBlob(extraction.pdfUrl);
      const pageCount = await getPdfPageCount(pdfBuffer);

      if (pageCount > LARGE_PDF_THRESHOLD) {
        // ── Large PDF: Split and process in two parts ──
        console.log(`[Split/Retry] PDF has ${pageCount} pages. Finding optimal split point...`);
        const splitPage = await findSplitPoint(pdfBuffer, SPLIT_TARGET_PAGE, apiKey);
        console.log(`[Split/Retry] Splitting at page ${splitPage}`);

        const { part1, part2 } = await splitPdf(pdfBuffer, splitPage);

        // Process Part 1
        console.log('[Split/Retry] Processing Part 1...');
        const result1 = await extractFromPdf(part1, apiKey, model);

        const parsedResult1 = extractJson(result1.text);

        // Save Part 1 immediately
        await ExtractionModel.findByIdAndUpdate(extraction._id, {
          result: parsedResult1,
          tokenUsage: { inputTokens: result1.inputTokens, outputTokens: result1.outputTokens },
        });

        // Process Part 2
        console.log('[Split/Retry] Processing Part 2...');
        const result2 = await extractFromPdf(part2, apiKey, model);

        const parsedResult2 = extractJson(result2.text);

        // Merge Part 2 into existing Part 1 (additive)
        const mergedResult = mergeResults(parsedResult1, parsedResult2);

        await ExtractionModel.findByIdAndUpdate(extraction._id, {
          status: ExtractionStatus.COMPLETED,
          result: mergedResult,
          tokenUsage: {
            inputTokens: result1.inputTokens + result2.inputTokens,
            outputTokens: result1.outputTokens + result2.outputTokens,
          },
        });
        console.log('[Split/Retry] Both parts processed and merged successfully.');

      } else {
        // ── Normal PDF: Single-pass ──
        const result = await extractFromPdf(pdfBuffer, apiKey, model);

        const parsedResult = extractJson(result.text);

        await ExtractionModel.findByIdAndUpdate(extraction._id, {
          status: ExtractionStatus.COMPLETED,
          result: parsedResult,
          tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
        });
      }
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

