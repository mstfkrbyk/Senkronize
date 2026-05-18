import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Hepsiburada webhook: SHA-256(webhookSecret + rawBody) (hex).
 * `X-HB-Signature` başlığı ile karşılaştırılır.
 */
export function verifyHepsiburadaSignatureDigest(
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
  const digest = createHash('sha256')
    .update(Buffer.concat([Buffer.from(secret, 'utf8'), rawBody]))
    .digest('hex');
  try {
    const a = Buffer.from(digest, 'utf8');
    const b = Buffer.from(expectedHex.toLowerCase(), 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
