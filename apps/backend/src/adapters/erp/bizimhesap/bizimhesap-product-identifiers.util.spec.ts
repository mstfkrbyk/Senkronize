import {
  resolveBizimHesapBarcode,
  resolveBizimHesapSku,
} from './bizimhesap-product-identifiers.util';

describe('bizimhesap-product-identifiers', () => {
  it('reads barcode only from barcode fields', () => {
    expect(
      resolveBizimHesapBarcode({
        Barcode: '8690123456789',
        Code: 'MIX-001',
      }),
    ).toBe('8690123456789');
    expect(resolveBizimHesapBarcode({ Code: 'MIX-001' })).toBe('');
  });

  it('reads sku from code fields, then falls back to product id', () => {
    expect(
      resolveBizimHesapSku({
        Barcode: '8690123456789',
        Code: 'MIX-001',
      }),
    ).toBe('MIX-001');
    expect(resolveBizimHesapSku({ Barcode: '8690123456789', id: 'abc-123' })).toBe('abc-123');
    expect(resolveBizimHesapSku({ Barcode: '8690123456789' })).toBe('');
  });
});
