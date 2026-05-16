import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Trendyol webhook gövdesi için HMAC-SHA256 (hex) doğrulama.
 * `X-Trendyol-Signature` başlığı ham gövde üzerinden hesaplanır.
 */
export function verifyTrendyolSignature(
  signatureHeader: string | undefined,
  rawBody: Buffer,
  secret: string,
): boolean {
  if (signatureHeader === undefined || signatureHeader.length === 0) {
    return false;
  }
  let expectedHex = signatureHeader.trim();
  const lower = expectedHex.toLowerCase();
  if (lower.startsWith('sha256=')) {
    expectedHex = expectedHex.slice(7).trim();
  }
  const hmacHex = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(hmacHex, 'utf8');
    const b = Buffer.from(expectedHex.toLowerCase(), 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
