import { describe, expect, it } from 'vitest';

import {
  resolveListingPushNoteKey,
  resolveListingPushNoteLink,
} from './listing-push-notes';

describe('listing-push-notes', () => {
  it('price note follows accounting mode', () => {
    expect(
      resolveListingPushNoteKey('price', {
        accountingMode: 'NATIVE',
        orgProducts: ['INTEGRATION', 'ACCOUNTING'],
      }),
    ).toBe('listings.detail.push.price.native');
    expect(
      resolveListingPushNoteKey('price', {
        accountingMode: 'EXTERNAL_ERP',
        orgProducts: ['INTEGRATION'],
      }),
    ).toBe('listings.detail.push.price.externalErp');
  });

  it('stock note uses native accounting placement when applicable', () => {
    expect(
      resolveListingPushNoteKey('stock', {
        accountingMode: 'NATIVE',
        orgProducts: ['ACCOUNTING'],
      }),
    ).toBe('listings.detail.push.stock.nativeAccounting');
    expect(
      resolveListingPushNoteLink('stock', {
        accountingMode: 'NATIVE',
        orgProducts: ['ACCOUNTING'],
      }),
    ).toEqual({
      to: '/products?tab=status',
      labelKey: 'listings.detail.push.stockLink.inventory',
    });
  });

  it('stock note for integration-only native points to channel stock', () => {
    expect(
      resolveListingPushNoteKey('stock', {
        accountingMode: 'NATIVE',
        orgProducts: ['INTEGRATION'],
      }),
    ).toBe('listings.detail.push.stock.nativeIntegration');
    expect(
      resolveListingPushNoteLink('stock', {
        accountingMode: 'NATIVE',
        orgProducts: ['INTEGRATION'],
      })?.to,
    ).toBe('/products?tab=status');
  });

  it('stock note for external ERP links to ERP connections', () => {
    expect(
      resolveListingPushNoteKey('stock', {
        accountingMode: 'EXTERNAL_ERP',
        orgProducts: ['INTEGRATION', 'ACCOUNTING'],
      }),
    ).toBe('listings.detail.push.stock.externalErp');
    expect(
      resolveListingPushNoteLink('stock', {
        accountingMode: 'EXTERNAL_ERP',
        orgProducts: ['INTEGRATION'],
      }),
    ).toEqual({
      to: '/connections?tab=erp',
      labelKey: 'listings.detail.push.stockLink.erp',
    });
  });
});
