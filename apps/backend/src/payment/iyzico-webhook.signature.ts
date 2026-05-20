import { createHmac } from 'crypto';
import type { IyzicoWebhookPayload } from './iyzico.types';

/**
 * Iyzico abonelik webhook imza doğrulaması (X-IYZ-SIGNATURE-V3).
 * @see https://docs.iyzico.com/en/advanced/webhook
 */
export function verifyIyzicoSubscriptionWebhookSignature(
  payload: IyzicoWebhookPayload,
  signatureHeader: string | undefined,
  secretKey: string,
  merchantId: string,
): boolean {
  if (!signatureHeader?.trim()) {
    return false;
  }
  const eventType = String(
    payload.iyziEventType ?? payload.eventType ?? '',
  ).trim();
  const subscriptionReferenceCode = String(
    payload.subscriptionReferenceCode ?? '',
  ).trim();
  const orderReferenceCode = String(payload.orderReferenceCode ?? '').trim();
  const customerReferenceCode = String(
    payload.customerReferenceCode ?? '',
  ).trim();

  const message =
    merchantId +
    secretKey +
    eventType +
    subscriptionReferenceCode +
    orderReferenceCode +
    customerReferenceCode;

  const expected = createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return expected === signatureHeader.trim();
}
