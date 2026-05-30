import { describe, expect, it } from 'vitest';

import {
  isStockTabId,
  resolveStockSubtitleKey,
  STOCK_TABS,
} from './stock-tabs.config';

describe('STOCK_TABS', () => {
  it('exposes i18n label keys for every tab', () => {
    expect(STOCK_TABS.map((tab) => tab.labelKey)).toEqual([
      'stock.tabs.status',
      'stock.tabs.warehouses',
      'stock.tabs.movements',
      'stock.tabs.transfers',
      'stock.tabs.forecast',
    ]);
  });
});

describe('isStockTabId', () => {
  it('accepts known tab ids', () => {
    expect(isStockTabId('status')).toBe(true);
    expect(isStockTabId('forecast')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isStockTabId(null)).toBe(false);
    expect(isStockTabId('invalid')).toBe(false);
  });
});

describe('resolveStockSubtitleKey', () => {
  it('native accounting org → nativeAccounting subtitle', () => {
    expect(resolveStockSubtitleKey(['ACCOUNTING'], 'NATIVE')).toBe(
      'stock.subtitle.nativeAccounting',
    );
  });

  it('integration-only org → ecommerce subtitle', () => {
    expect(resolveStockSubtitleKey(['INTEGRATION'], 'NATIVE')).toBe(
      'stock.subtitle.ecommerce',
    );
  });

  it('bundle + NATIVE → nativeAccounting subtitle', () => {
    expect(
      resolveStockSubtitleKey(['INTEGRATION', 'ACCOUNTING'], 'NATIVE'),
    ).toBe('stock.subtitle.nativeAccounting');
  });

  it('bundle + EXTERNAL_ERP → ecommerce subtitle', () => {
    expect(
      resolveStockSubtitleKey(['INTEGRATION', 'ACCOUNTING'], 'EXTERNAL_ERP'),
    ).toBe('stock.subtitle.ecommerce');
  });
});
