import xss from 'xss';

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return xss(input.trim());
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = xss(value.trim());
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
