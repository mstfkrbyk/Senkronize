import {
  buildProductWhereForListingMatch,
  buildProductWhereForMatchKey,
  parseOptionalProductMatchKey,
  resolveEffectiveProductMatchKey,
  resolveListingMatchIdentifiers,
  resolveStockBarcode,
} from './product-match-key';

describe('product-match-key', () => {
  it('parses optional match key', () => {
    expect(parseOptionalProductMatchKey('SKU')).toBe('SKU');
    expect(parseOptionalProductMatchKey('MANUAL')).toBe('MANUAL');
    expect(parseOptionalProductMatchKey('BARCODE')).toBe('BARCODE');
    expect(parseOptionalProductMatchKey('invalid')).toBeNull();
  });

  it('resolves hierarchy product > connection > org', () => {
    expect(
      resolveEffectiveProductMatchKey({
        productMatchKey: 'SKU',
        connectionMatchKey: 'BARCODE',
        orgMatchKey: 'MANUAL',
      }),
    ).toBe('SKU');
    expect(
      resolveEffectiveProductMatchKey({
        connectionMatchKey: 'SKU',
        orgMatchKey: 'BARCODE',
      }),
    ).toBe('SKU');
    expect(resolveEffectiveProductMatchKey({ orgMatchKey: 'MANUAL' })).toBe('MANUAL');
    expect(resolveEffectiveProductMatchKey({})).toBeNull();
  });

  it('builds barcode where clause', () => {
    expect(
      buildProductWhereForMatchKey('org-1', 'BARCODE', {
        barcode: '869',
        sku: 'SKU-1',
      }),
    ).toEqual({
      organizationId: 'org-1',
      barcode: '869',
      deletedAt: null,
    });
  });

  it('builds sku where clause with fallback', () => {
    expect(
      buildProductWhereForMatchKey('org-1', 'SKU', {
        barcode: '',
        sku: '',
      }),
    ).toBeNull();
    expect(
      buildProductWhereForMatchKey('org-1', 'SKU', {
        barcode: '869',
        sku: '',
      }),
    ).toEqual({
      organizationId: 'org-1',
      sku: '869',
      deletedAt: null,
    });
  });

  it('builds listing sku where with barcode fallback', () => {
    expect(
      buildProductWhereForListingMatch('org-1', 'SKU', {
        barcode: '869',
        sku: 'SKU-1',
      }),
    ).toEqual({
      organizationId: 'org-1',
      deletedAt: null,
      OR: [
        { sku: 'SKU-1' },
        { barcode: 'SKU-1' },
        { sku: '869' },
        { barcode: '869' },
      ],
    });
  });

  it('resolves listing match identifiers with platform sku', () => {
    expect(
      resolveListingMatchIdentifiers({ barcode: '869' }, 'STOK-1'),
    ).toEqual({ barcode: '869', sku: 'STOK-1' });
  });

  it('returns null for manual lookup', () => {
    expect(
      buildProductWhereForMatchKey('org-1', 'MANUAL', {
        barcode: '869',
        sku: 'SKU-1',
      }),
    ).toBeNull();
  });

  it('resolves stock barcode fallback', () => {
    expect(resolveStockBarcode('', 'SKU-1')).toBe('SKU-1');
    expect(resolveStockBarcode('869', 'SKU-1')).toBe('869');
  });
});
