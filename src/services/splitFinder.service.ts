import Anthropic from '@anthropic-ai/sdk';
import { extractPageRange } from '../utils/pdfSplit';

const SPLIT_FINDER_MODEL = 'claude-sonnet-4-6';

const SPLIT_FINDER_PROMPT = `You are a document analysis assistant. You are given a few pages from a large maritime technical PDF.

Your task: Determine the BEST page number to split this document into two halves for separate processing.

The ideal split point is a page where a NEW component/system/section begins — so that no single component's data is broken across two chunks.

You will be given pages around the ~200 page mark of the document. Check each page starting from the LAST page you are given, going backwards. For each page, determine:
- Does this page start a NEW component, system, section, or chapter?
- Or is this page a CONTINUATION of the previous page's content?

Return ONLY a JSON object in this exact format:
{"split_page": <number>, "reason": "<brief explanation>"}

Where "split_page" is the 1-indexed page number (relative to the FULL original document) where the new section begins. This will be the first page of the SECOND chunk.

IMPORTANT: The page numbers shown in the document footer/header are the ORIGINAL page numbers from the full document. Use those numbers in your response, NOT the page index within this small excerpt.

Return ONLY valid JSON. No markdown. No explanation outside the JSON.`;

/**
 * Uses Claude Sonnet to find the optimal page to split a large PDF.
 * It sends a small window of pages around the midpoint and asks Sonnet
 * to walk backwards from page ~200 to find where a new component starts.
 *
 * @param pdfBuffer - The full PDF buffer
 * @param targetPage - The target midpoint (e.g. 200)
 * @param apiKey - Anthropic API key
 * @returns The 1-indexed page number to split at (first page of second chunk)
 */
export async function findSplitPoint(
  pdfBuffer: Buffer,
  targetPage: number,
  apiKey: string,
): Promise<number> {
  // Extract a window of pages: targetPage-10 to targetPage+5
  // This gives Sonnet enough context to see section boundaries
  const windowStart = Math.max(1, targetPage - 10);
  const windowEnd = targetPage + 5;

  const excerptBuffer = await extractPageRange(pdfBuffer, windowStart, windowEnd);
  const base64 = excerptBuffer.toString('base64');

  const client = new Anthropic({
    apiKey,
    timeout: 2 * 60 * 1000, // 2 minutes is plenty for this small task
  });

  const response = await client.messages.create({
    model: SPLIT_FINDER_MODEL,
    max_tokens: 256,
    system: SPLIT_FINDER_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: 'text',
            text: `These are pages ${windowStart}–${windowEnd} from a ${targetPage * 2}+ page maritime technical document. Find the best split point by checking from page ${targetPage} backwards. Return the JSON.`,
          },
        ],
      },
    ],
  });

  // Extract the text response
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.warn('Split finder returned no text, defaulting to target page');
    return targetPage;
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    const splitPage = parseInt(parsed.split_page, 10);
    if (isNaN(splitPage) || splitPage < 1) {
      console.warn('Invalid split_page from Sonnet, defaulting to target page');
      return targetPage;
    }
    console.log(`Split finder chose page ${splitPage}: ${parsed.reason}`);
    return splitPage;
  } catch {
    console.warn('Failed to parse split finder response, defaulting to target page');
    return targetPage;
  }
}
