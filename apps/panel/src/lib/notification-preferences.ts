import { api } from '@/lib/api';

export type DigestFrequency = 'realtime' | 'daily' | 'weekly';

export type NotificationPrefKey =
  | 'emailEnabled'
  | 'emailNewOrder'
  | 'emailLowStock'
  | 'emailStockOut'
  | 'emailSyncError'
  | 'emailWeeklyReport'
  | 'emailTicketReply'
  | 'emailPlanExpiry'
  | 'pushEnabled'
  | 'pushNewOrder'
  | 'pushLowStock'
  | 'pushSyncError'
  | 'inAppEnabled'
  | 'inAppSoundEnabled'
  | 'smsEnabled'
  | 'digestFrequency'
  | 'digestHour';

export interface NotificationPrefs {
  id: string;
  organizationId: string;
  userId: string;
  emailEnabled: boolean;
  emailNewOrder: boolean;
  emailLowStock: boolean;
  emailStockOut: boolean;
  emailSyncError: boolean;
  emailWeeklyReport: boolean;
  emailTicketReply: boolean;
  emailPlanExpiry: boolean;
  pushEnabled: boolean;
  pushNewOrder: boolean;
  pushLowStock: boolean;
  pushSyncError: boolean;
  inAppEnabled: boolean;
  inAppSoundEnabled: boolean;
  smsEnabled: boolean;
  digestFrequency: DigestFrequency;
  digestHour: number;
}

export type NotificationPrefPatch = Partial<
  Pick<NotificationPrefs, NotificationPrefKey>
>;

export async function fetchNotificationPreferences(): Promise<NotificationPrefs> {
  const { data } = await api.get<{ data: NotificationPrefs }>(
    '/notifications/preferences',
  );
  return data.data;
}

export async function patchNotificationPreferences(
  body: NotificationPrefPatch,
): Promise<NotificationPrefs> {
  const { data } = await api.patch<{ data: NotificationPrefs }>(
    '/notifications/preferences',
    body,
  );
  return data.data;
}
