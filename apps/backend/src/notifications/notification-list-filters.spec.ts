import { NotificationType } from '@prisma/client';

import {
  intersectNotificationTypes,
  typesForListFilter,
  typesForScope,
} from './notification-list-filters';

describe('notification-list-filters', () => {
  it('scope integration pazaryeri tiplerini döner', () => {
    const types = typesForScope('integration');
    expect(types).toContain(NotificationType.ORDER_NEW);
    expect(types).not.toContain(NotificationType.SYSTEM);
  });

  it('scope accounting sistem ve ödeme tiplerini döner', () => {
    const types = typesForScope('accounting');
    expect(types).toContain(NotificationType.SYSTEM);
    expect(types).not.toContain(NotificationType.ORDER_NEW);
  });

  it('filter ve scope kesişimi boşsa boş dizi döner', () => {
    const order = typesForListFilter('order');
    const accounting = typesForScope('accounting');
    expect(intersectNotificationTypes(order, accounting)).toEqual([]);
  });
});
