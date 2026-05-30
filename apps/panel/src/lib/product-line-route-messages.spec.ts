import { describe, expect, it } from 'vitest';

import { resolveProductLineRedirectToastKey } from './product-line-route-messages';

const BUNDLE: ('INTEGRATION' | 'ACCOUNTING')[] = ['INTEGRATION', 'ACCOUNTING'];

describe('resolveProductLineRedirectToastKey', () => {
  it('stok dışı → genel entegrasyon toast', () => {
    expect(
      resolveProductLineRedirectToastKey('INTEGRATION', {
        pathname: '/orders',
        orgProducts: ['ACCOUNTING'],
        accountingMode: 'NATIVE',
      }),
    ).toBe('productLineRoute.integration.redirectToast');
  });

  it('/stock + NATIVE + ACCOUNTING hattı → yerel envanter toast', () => {
    expect(
      resolveProductLineRedirectToastKey('ACCOUNTING', {
        pathname: '/stock',
        orgProducts: BUNDLE,
        accountingMode: 'NATIVE',
      }),
    ).toBe('productLineRoute.stock.accounting.redirectToast');
  });

  it('/stock + EXTERNAL_ERP + INTEGRATION hattı → harici muhasebe toast', () => {
    expect(
      resolveProductLineRedirectToastKey('INTEGRATION', {
        pathname: '/stock/items',
        orgProducts: BUNDLE,
        accountingMode: 'EXTERNAL_ERP',
      }),
    ).toBe('productLineRoute.stock.integrationExternalErp.redirectToast');
  });

  it('/stock reddi gerekli hat stok hattından farklı → genel toast', () => {
    expect(
      resolveProductLineRedirectToastKey('ACCOUNTING', {
        pathname: '/stock',
        orgProducts: BUNDLE,
        accountingMode: 'EXTERNAL_ERP',
      }),
    ).toBe('productLineRoute.accounting.redirectToast');
  });
});
