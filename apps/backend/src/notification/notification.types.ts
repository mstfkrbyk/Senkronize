export type NotificationChannel = 'email' | 'sms' | 'inapp';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface SmsPayload {
  /** 905xxxxxxxxx */
  to: string;
  message: string;
}

export type NotificationTemplate =
  | 'welcome'
  | 'trial_ending'
  | 'trial_expired'
  | 'payment_success'
  | 'payment_failed'
  | 'order_new'
  | 'stock_alert'
  | 'sync_error'
  | 'invite_user'
  | 'password_reset';

export interface TemplateData {
  [key: string]: string | number | boolean | undefined;
}

export function toTemplateData(
  payload: Record<string, unknown>,
): TemplateData {
  const result: TemplateData = {};
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === undefined
    ) {
      result[key] = value;
    }
  }
  return result;
}
