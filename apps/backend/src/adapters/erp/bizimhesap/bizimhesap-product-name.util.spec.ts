import { resolveBizimHesapProductName } from './bizimhesap-product-name.util';

describe('resolveBizimHesapProductName', () => {
  it('reads common name fields', () => {
    expect(resolveBizimHesapProductName({ Name: 'Ampul' })).toBe('Ampul');
    expect(resolveBizimHesapProductName({ productName: 'Kablo' })).toBe('Kablo');
  });

  it('reads Turkish ERP field names', () => {
    expect(resolveBizimHesapProductName({ StokAdi: 'LED Lamba' })).toBe('LED Lamba');
    expect(resolveBizimHesapProductName({ UrunAdi: 'Priz' })).toBe('Priz');
  });

  it('falls back to barcode before generic label', () => {
    expect(resolveBizimHesapProductName({}, '8690123456789')).toBe('8690123456789');
    expect(resolveBizimHesapProductName({})).toBe('Ürün');
  });
});
