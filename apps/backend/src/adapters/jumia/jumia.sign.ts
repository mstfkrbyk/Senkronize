import { createHmac } from 'node:crypto';

/** Jumia REST — HMAC-SHA256 (X-API-Key + X-Signature) */
export function jumiaSign(
  apiSecret: string,
  method: string,
  pathWithQuery: string,
  timestamp: string,
  body = '',
): string {
  const payload = `${method.toUpperCase()}${pathWithQuery}${timestamp}${body}`;
  return createHmac('sha256', apiSecret).update(payload, 'utf8').digest('hex');
}
