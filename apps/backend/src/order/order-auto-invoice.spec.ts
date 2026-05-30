import { AccountingMode, OrderStatus } from '@prisma/client';

import {
  shouldTriggerOrderAutoInvoice,
  shouldTriggerOrderAutoInvoiceFromPlatformWebhook,
} from './order-auto-invoice';

describe('shouldTriggerOrderAutoInvoice', () => {
  it('SHIPPED veya DELIVERED geçişinde autoInvoice açıksa tetikler', () => {
    expect(
      shouldTriggerOrderAutoInvoice(true, OrderStatus.PICKING, OrderStatus.SHIPPED),
    ).toBe(true);
    expect(
      shouldTriggerOrderAutoInvoice(true, OrderStatus.SHIPPED, OrderStatus.DELIVERED),
    ).toBe(true);
  });

  it('autoInvoice kapalı veya durum değişmediyse tetiklemez', () => {
    expect(
      shouldTriggerOrderAutoInvoice(false, OrderStatus.PICKING, OrderStatus.SHIPPED),
    ).toBe(false);
    expect(
      shouldTriggerOrderAutoInvoice(true, OrderStatus.SHIPPED, OrderStatus.SHIPPED),
    ).toBe(false);
    expect(
      shouldTriggerOrderAutoInvoice(true, OrderStatus.PICKING, OrderStatus.INVOICED),
    ).toBe(false);
  });
});

describe('shouldTriggerOrderAutoInvoiceFromPlatformWebhook', () => {
  it('NATIVE org webhook durumunda otomatik fatura tetiklemez', () => {
    expect(
      shouldTriggerOrderAutoInvoiceFromPlatformWebhook(
        AccountingMode.NATIVE,
        0,
        true,
        OrderStatus.PICKING,
        OrderStatus.SHIPPED,
      ),
    ).toBe(false);
    expect(
      shouldTriggerOrderAutoInvoiceFromPlatformWebhook(
        AccountingMode.NATIVE,
        0,
        true,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ),
    ).toBe(false);
  });

  it('çözümlenen NATIVE (null mod, aktif ERP yok) webhook tetiklemez', () => {
    expect(
      shouldTriggerOrderAutoInvoiceFromPlatformWebhook(
        null,
        0,
        true,
        OrderStatus.PICKING,
        OrderStatus.SHIPPED,
      ),
    ).toBe(false);
  });

  it('EXTERNAL_ERP org webhook durumunda mevcut kuralları uygular', () => {
    expect(
      shouldTriggerOrderAutoInvoiceFromPlatformWebhook(
        AccountingMode.EXTERNAL_ERP,
        1,
        true,
        OrderStatus.PICKING,
        OrderStatus.SHIPPED,
      ),
    ).toBe(true);
  });
});
