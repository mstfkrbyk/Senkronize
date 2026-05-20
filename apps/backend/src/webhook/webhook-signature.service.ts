import { Injectable } from '@nestjs/common';
import {
  createHash,
  createHmac,
  timingSafeEqual,
  verify as cryptoVerify,
} from 'node:crypto';
import { get as httpsGet } from 'node:https';
import { URL } from 'node:url';

import { verifyHepsiburadaSignatureDigest } from './hepsiburada-signature.util';
import { verifyTrendyolSignature } from './trendyol-signature.util';

function safeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function hepsiburadaSha512Hex(rawBody: Buffer, secret: string): string {
  return createHash('sha512')
    .update(Buffer.concat([Buffer.from(secret, 'utf8'), rawBody]))
    .digest('hex');
}

function isAllowedSnsSigningCertUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') {
      return false;
    }
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith('.amazonaws.com') &&
      (host.startsWith('sns.') || host.includes('.sns.'))
    );
  } catch {
    return false;
  }
}

function fetchHttpsText(urlStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(
      urlStr,
      { timeout: 10_000 },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${String(res.statusCode)}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          chunks.push(c);
        });
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Amazon SNS HTTP(S) mesajı — imza doğrulama için alanlar */
type SnsMessageLike = {
  Type?: string;
  MessageId?: string;
  Message?: string;
  Subject?: string;
  Timestamp?: string;
  TopicArn?: string;
  SubscribeURL?: string;
  Token?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
};

function buildSnsStringToSign(msg: SnsMessageLike): string | null {
  const type = msg.Type;
  if (type === 'Notification') {
    if (msg.SignatureVersion === '2') {
      return null;
    }
    let s = '';
    if (msg.Message !== undefined) {
      s += `Message\n${msg.Message}\n`;
    }
    if (msg.MessageId !== undefined) {
      s += `MessageId\n${msg.MessageId}\n`;
    }
    if (msg.Subject !== undefined && msg.Subject.length > 0) {
      s += `Subject\n${msg.Subject}\n`;
    }
    if (msg.Timestamp !== undefined) {
      s += `Timestamp\n${msg.Timestamp}\n`;
    }
    if (msg.TopicArn !== undefined) {
      s += `TopicArn\n${msg.TopicArn}\n`;
    }
    if (type !== undefined) {
      s += `Type\n${type}\n`;
    }
    return s;
  }
  if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
    let s = '';
    if (msg.Message !== undefined) {
      s += `Message\n${msg.Message}\n`;
    }
    if (msg.MessageId !== undefined) {
      s += `MessageId\n${msg.MessageId}\n`;
    }
    if (msg.SubscribeURL !== undefined) {
      s += `SubscribeURL\n${msg.SubscribeURL}\n`;
    }
    if (msg.Timestamp !== undefined) {
      s += `Timestamp\n${msg.Timestamp}\n`;
    }
    if (msg.Token !== undefined) {
      s += `Token\n${msg.Token}\n`;
    }
    if (msg.TopicArn !== undefined) {
      s += `TopicArn\n${msg.TopicArn}\n`;
    }
    if (type !== undefined) {
      s += `Type\n${type}\n`;
    }
    return s;
  }
  return null;
}

@Injectable()
export class WebhookSignatureService {
  /**
   * Trendyol: HMAC-SHA256; platform hem hex hem base64 imza gönderebilir.
   */
  verifyTrendyol(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!signature?.trim()) {
      return false;
    }
    const trimmed = signature.trim();
    const hmacHex = createHmac('sha256', secret).update(rawBody).digest('hex');
    const hmacB64 = createHmac('sha256', secret).update(rawBody).digest('base64');
    if (safeEqualUtf8(trimmed.toLowerCase(), hmacHex.toLowerCase())) {
      return true;
    }
    if (safeEqualUtf8(trimmed, hmacB64)) {
      return true;
    }
    return verifyTrendyolSignature(trimmed, rawBody, secret);
  }

  /**
   * Hepsiburada: SHA-512(secret + rawBody) hex veya mevcut SHA-256(secret + rawBody) hex.
   */
  verifyHepsiburada(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature?.trim()) {
      return false;
    }
    const expected512 = hepsiburadaSha512Hex(rawBody, secret);
    const sig = signature.trim().toLowerCase().replace(/^sha512=/, '');
    if (sig.length === 128 && safeEqualUtf8(sig, expected512.toLowerCase())) {
      return true;
    }
    return verifyHepsiburadaSignatureDigest(signature, rawBody, secret);
  }

  /**
   * n11: Authorization: Basic base64 — parola kısmı webhook secret ile eşleşmeli.
   */
  verifyN11(rawBody: Buffer, authorization: string, secret: string): boolean {
    void rawBody;
    if (!authorization?.toLowerCase().startsWith('basic ')) {
      return false;
    }
    const b64 = authorization.slice(6).trim();
    let decoded: string;
    try {
      decoded = Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return false;
    }
    const colon = decoded.indexOf(':');
    const password = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    return safeEqualUtf8(password, secret);
  }

  /**
   * Amazon SNS: RSA-SHA1 ile SigningCertURL üzerinden doğrulama.
   */
  async verifyAmazon(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<boolean> {
    void headers;
    let msg: SnsMessageLike;
    try {
      msg = JSON.parse(rawBody.toString('utf8')) as SnsMessageLike;
    } catch {
      return false;
    }
    if (msg.SignatureVersion !== '1' || !msg.Signature || !msg.SigningCertURL) {
      return false;
    }
    if (!isAllowedSnsSigningCertUrl(msg.SigningCertURL)) {
      return false;
    }
    const stringToSign = buildSnsStringToSign(msg);
    if (!stringToSign) {
      return false;
    }
    let pem: string;
    try {
      pem = await fetchHttpsText(msg.SigningCertURL);
    } catch {
      return false;
    }
    if (!pem.includes('BEGIN CERTIFICATE')) {
      return false;
    }
    try {
      return cryptoVerify(
        'RSA-SHA1',
        Buffer.from(stringToSign, 'utf8'),
        pem,
        Buffer.from(msg.Signature, 'base64'),
      );
    } catch {
      return false;
    }
  }

  /** Shopify: X-Shopify-Hmac-Sha256 — base64(HMAC-SHA256(body)) */
  verifyShopify(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!signature?.trim()) {
      return false;
    }
    const digest = createHmac('sha256', secret).update(rawBody).digest('base64');
    return safeEqualUtf8(signature.trim(), digest);
  }

  /** Ticimax: X-Ticimax-Signature — HMAC-SHA256 (apiKey + body) */
  verifyTicimax(rawBody: Buffer, signature: string, apiKey: string): boolean {
    return this.verifyHmacSha256(rawBody, signature, apiKey, 'hex');
  }

  /** WooCommerce: X-WC-Webhook-Signature — HMAC-SHA256 hex */
  verifyWooCommerce(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    return this.verifyHmacSha256(rawBody, signature, secret, 'hex');
  }

  verifyHmacSha256(
    rawBody: Buffer,
    signature: string,
    secret: string,
    encoding: 'hex' | 'base64' = 'hex',
  ): boolean {
    if (!signature?.trim()) {
      return false;
    }
    let expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest(encoding);
    let sig = signature.trim();
    const lower = sig.toLowerCase();
    if (encoding === 'hex' && lower.startsWith('sha256=')) {
      sig = sig.slice(7).trim();
    }
    if (encoding === 'hex') {
      expected = expected.toLowerCase();
      sig = sig.toLowerCase();
    }
    return safeEqualUtf8(sig, expected);
  }
}
