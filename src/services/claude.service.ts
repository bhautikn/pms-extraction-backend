import Anthropic from '@anthropic-ai/sdk';
import { downloadPromptFromBlob } from './azure.service';

let SYSTEM_PROMPT: string;

async function getSystemPrompt(): Promise<string> {
  if (!SYSTEM_PROMPT) {
    try {
      SYSTEM_PROMPT = await downloadPromptFromBlob();
      console.log('Successfully fetched system prompt from Azure Storage');
    } catch (err) {
      console.error('Failed to fetch system prompt from Azure Storage. Ensure /prompt/system-prompt.md exists.', err);
      throw new Error('Failed to load system prompt from storage.');
    }
  }
  return SYSTEM_PROMPT;
}

/**
 * Pre-warm the system prompt cache so the first extraction
 * doesn't pay the cold-start latency of fetching from Azure Blob.
 */
export async function preWarmSystemPrompt(): Promise<void> {
  await getSystemPrompt();
}

/**
 * Returns the cached system prompt text. Useful for storing
 * which prompt was used for a given extraction.
 */
export async function getSystemPromptText(): Promise<string> {
  return getSystemPrompt();
}

export interface ClaudeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function extractFromPdf(
  pdfBuffer: Buffer,
  apiKey: string,
  model: string,
): Promise<ClaudeResult> {
  const client = new Anthropic({
    apiKey,
    timeout: 10 * 60 * 1000, // 10 minutes
  });

  const base64 = pdfBuffer.toString('base64');
  const systemPrompt = await getSystemPrompt();

  const stream = await client.messages.stream({
    model,
    max_tokens: 128000,
    system: systemPrompt,
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
            text: 'Analyze this complete PDF document and extract all maritime components, spare parts, and maintenance jobs. Output ONLY the consolidated JSON as specified in your instructions.',
          },
        ],
      },
    ],
  });

  let text = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta'
    ) {
      text += event.delta.text;
    }
  }

  const finalMessage = await stream.finalMessage();

  return {
    text,
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };
}

