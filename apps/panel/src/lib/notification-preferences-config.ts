import type { NotificationPrefKey, NotificationPrefs } from '@/lib/notification-preferences';

export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'push';

export interface PreferenceEventConfig {
  id: string;
  label: string;
  description?: string;
  channels: Partial<Record<NotificationChannel, NotificationPrefKey>>;
}

export interface PreferenceCategoryConfig {
  id: string;
  title: string;
  description: string;
  events: PreferenceEventConfig[];
}

export const NOTIFICATION_PREFERENCE_CATEGORIES: PreferenceCategoryConfig[] = [
  {
    id: 'orders',
    title: 'Sipariş bildirimleri',
    description: 'Yeni sipariş, durum, kargo ve iptal güncellemeleri.',
    events: [
      {
        id: 'new_order',
        label: 'Yeni sipariş',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailNewOrder',
          push: 'pushNewOrder',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'order_status',
        label: 'Durum değişikliği',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailNewOrder',
          push: 'pushNewOrder',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'shipping',
        label: 'Kargo güncellemesi',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailNewOrder',
          push: 'pushNewOrder',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'cancel',
        label: 'Sipariş iptali',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailNewOrder',
          push: 'pushNewOrder',
          sms: 'smsEnabled',
        },
      },
    ],
  },
  {
    id: 'stock',
    title: 'Stok uyarıları',
    description: 'Kritik stok, tükenme ve eşik aşımı bildirimleri.',
    events: [
      {
        id: 'critical_stock',
        label: 'Kritik stok',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailLowStock',
          push: 'pushLowStock',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'stock_out',
        label: 'Stok bitti',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailStockOut',
          push: 'pushLowStock',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'threshold',
        label: 'Eşik aşıldı',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailLowStock',
          push: 'pushLowStock',
          sms: 'smsEnabled',
        },
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Fiyat uyarıları',
    description: 'BuyBox ve rakip fiyat değişimleri.',
    events: [
      {
        id: 'buybox_lost',
        label: 'BuyBox kaybedildi',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailEnabled',
          push: 'pushEnabled',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'competitor_price',
        label: 'Rakip fiyat değişimi',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailEnabled',
          push: 'pushEnabled',
          sms: 'smsEnabled',
        },
      },
    ],
  },
  {
    id: 'sync',
    title: 'Senkronizasyon',
    description: 'Sync hataları, tamamlanma ve bağlantı kesintileri.',
    events: [
      {
        id: 'sync_error',
        label: 'Sync hatası',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailSyncError',
          push: 'pushSyncError',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'sync_done',
        label: 'Sync tamamlandı',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailEnabled',
          push: 'pushEnabled',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'connection_lost',
        label: 'Bağlantı kesildi',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailSyncError',
          push: 'pushSyncError',
          sms: 'smsEnabled',
        },
      },
    ],
  },
  {
    id: 'security',
    title: 'Güvenlik',
    description: 'Yeni cihaz girişi ve şüpheli aktivite.',
    events: [
      {
        id: 'new_device',
        label: 'Yeni cihaz girişi',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailTicketReply',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'suspicious',
        label: 'Şüpheli aktivite',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailTicketReply',
          sms: 'smsEnabled',
        },
      },
    ],
  },
  {
    id: 'billing',
    title: 'Ödeme & Abonelik',
    description: 'Fatura, plan yenileme ve süre uyarıları.',
    events: [
      {
        id: 'invoice',
        label: 'Fatura hazır',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailPlanExpiry',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'plan_renewal',
        label: 'Plan yenileme',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailPlanExpiry',
          sms: 'smsEnabled',
        },
      },
      {
        id: 'plan_expiring',
        label: 'Plan sona eriyor',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailPlanExpiry',
          push: 'pushEnabled',
          sms: 'smsEnabled',
        },
      },
    ],
  },
  {
    id: 'digest',
    title: 'Digest & Raporlar',
    description: 'Günlük özet ve haftalık rapor e-postaları.',
    events: [
      {
        id: 'daily_digest',
        label: 'Günlük özet',
        channels: {
          email: 'emailEnabled',
        },
      },
      {
        id: 'weekly_report',
        label: 'Haftalık rapor',
        channels: {
          inApp: 'inAppEnabled',
          email: 'emailWeeklyReport',
        },
      },
    ],
  },
];

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inApp: 'Uygulama içi',
  email: 'E-posta',
  sms: 'SMS',
  push: 'Push',
};

export function channelLabel(channel: NotificationChannel): string {
  return CHANNEL_LABELS[channel];
}

export const CHANNEL_ORDER: NotificationChannel[] = [
  'inApp',
  'email',
  'sms',
  'push',
];

export function isChannelEnabled(
  prefs: NotificationPrefs,
  channel: NotificationChannel,
  key: NotificationPrefKey,
): boolean {
  if (channel === 'email' && !prefs.emailEnabled && key.startsWith('email') && key !== 'emailEnabled') {
    return false;
  }
  if (channel === 'push' && !prefs.pushEnabled && key.startsWith('push') && key !== 'pushEnabled') {
    return false;
  }
  if (channel === 'sms' && key === 'smsEnabled') {
    return prefs.smsEnabled;
  }
  const value = prefs[key];
  return typeof value === 'boolean' ? value : false;
}

export function masterChannelKey(channel: NotificationChannel): NotificationPrefKey | null {
  switch (channel) {
    case 'inApp':
      return 'inAppEnabled';
    case 'email':
      return 'emailEnabled';
    case 'push':
      return 'pushEnabled';
    case 'sms':
      return 'smsEnabled';
    default:
      return null;
  }
}
