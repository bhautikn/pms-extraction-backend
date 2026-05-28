/**
 * Safely extract and parse JSON from a Claude response.
 * Handles cases where the model wraps JSON in markdown fences,
 * adds leading/trailing text, or uses ```json ... ``` blocks.
 */
export function extractJson(raw: string): Record<string, unknown> {
  let text = raw.trim();

  // 1. Try direct parse first (ideal case)
  try {
    return JSON.parse(text);
  } catch {
    // continue to cleaning
  }

  // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Find the first '{' and the last '}' and try to parse that substring
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch {
      // continue
    }
  }

  // 4. Nothing worked — throw with a preview of the raw text for debugging
  const preview = text.length > 200 ? text.substring(0, 200) + '...' : text;
  throw new Error(`Claude returned invalid JSON. Preview: ${preview}`);
}
