import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT_PATH = path.join(__dirname, '..', 'config', 'system-prompt.md');
let SYSTEM_PROMPT: string;

function getSystemPrompt(): string {
  if (!SYSTEM_PROMPT) {
    SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
  }
  return SYSTEM_PROMPT;
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
  const systemPrompt = getSystemPrompt();

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
