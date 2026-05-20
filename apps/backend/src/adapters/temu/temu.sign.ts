import { createHmac } from 'node:crypto';

/**
 * Temu Seller API HMAC-SHA256 imzası.
 * signature = HmacSHA256(timestamp + method + path + body, secretKey)
 */
export function temuHmacSignature(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  secretKey: string,
): string {
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
  return createHmac('sha256', secretKey).update(payload, 'utf8').digest('hex');
}
