import { describe, expect, it } from 'vitest';

import {
  isIntegrationNotificationType,
  notificationMatchesProductCategory,
  resolveNotificationListScope,
  buildNotificationFilterOptions,
} from '@/lib/in-app-notification-categories';
import type { InAppNotification } from '@/store/notifications.store';

function notif(type: InAppNotification['type']): Pick<InAppNotification, 'type' | 'isRead'> {
  return { type, isRead: false };
}

describe('in-app-notification-categories', () => {
  it('pazaryeri tiplerini entegrasyon olarak sınıflandırır', () => {
    expect(isIntegrationNotificationType('ORDER_NEW')).toBe(true);
    expect(isIntegrationNotificationType('SYSTEM')).toBe(false);
  });

  it('accounting-only org için scope accounting döner', () => {
    expect(resolveNotificationListScope(['ACCOUNTING'], 'all')).toBe('accounting');
  });

  it('bundle orgda ürün kategorisine göre scope seçer', () => {
    expect(
      resolveNotificationListScope(['INTEGRATION', 'ACCOUNTING'], 'integration'),
    ).toBe('integration');
    expect(
      resolveNotificationListScope(['INTEGRATION', 'ACCOUNTING'], 'accounting'),
    ).toBe('accounting');
    expect(resolveNotificationListScope(['INTEGRATION', 'ACCOUNTING'], 'all')).toBe(
      undefined,
    );
  });

  it('accounting-only filtrelerde sipariş/stok yok', () => {
    const options = buildNotificationFilterOptions(['ACCOUNTING']);
    expect(options.map((o) => o.value)).not.toContain('order');
    expect(options.map((o) => o.value)).not.toContain('stock');
  });

  it('product category eşleşmesi', () => {
    expect(notificationMatchesProductCategory(notif('ORDER_NEW'), 'integration')).toBe(
      true,
    );
    expect(notificationMatchesProductCategory(notif('ORDER_NEW'), 'accounting')).toBe(
      false,
    );
    expect(notificationMatchesProductCategory(notif('SYSTEM'), 'accounting')).toBe(true);
  });
});
