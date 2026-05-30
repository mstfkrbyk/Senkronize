import {
  extractN11EventType,
  extractN11OrderStatus,
} from './n11-payload.util';

describe('n11-payload.util', () => {
  describe('extractN11EventType', () => {
    it('eventType alanını okur', () => {
      expect(
        extractN11EventType({ eventType: 'ORDER_STATUS_UPDATE' }),
      ).toBe('ORDER_STATUS_UPDATE');
    });

    it('geçersiz gövdede UNKNOWN döner', () => {
      expect(extractN11EventType(null)).toBe('UNKNOWN');
    });
  });

  describe('extractN11OrderStatus', () => {
    it('kök gövdeden sipariş kimliği ve durum çıkarır', () => {
      expect(
        extractN11OrderStatus({
          eventType: 'ORDER_STATUS_UPDATE',
          orderId: 9001,
          status: 'Shipped',
        }),
      ).toEqual({
        platformOrderId: '9001',
        status: 'Shipped',
      });
    });

    it('iç içe order nesnesini destekler', () => {
      expect(
        extractN11OrderStatus({
          eventType: 'ORDER_UPDATED',
          order: { orderNumber: 'N11-42', status: 'Delivered' },
        }),
      ).toEqual({
        platformOrderId: 'N11-42',
        status: 'Delivered',
      });
    });
  });
});
