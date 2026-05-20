import type { NotificationPreference } from '@prisma/client';

export const DIGEST_FREQUENCIES = ['realtime', 'daily', 'weekly'] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export const NOTIFICATION_EVENT_TYPES = [
  'new_order',
  'low_stock',
  'stock_out',
  'sync_error',
  'weekly_report',
  'ticket_reply',
  'plan_expiry',
  'payment_failed',
  'system',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export interface NotificationEvent {
  organizationId: string;
  type: NotificationEventType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
}

export type NotificationPreferencesResponse = NotificationPreference;

export function isDigestFrequency(value: string): value is DigestFrequency {
  return (DIGEST_FREQUENCIES as readonly string[]).includes(value);
}
