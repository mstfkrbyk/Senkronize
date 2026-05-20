import { validateMigrationRows } from './migration.validator';

describe('validateMigrationRows', () => {
  it('geçerli ürün satırını saymalı', () => {
    const result = validateMigrationRows(
      [{ barcode: 'A1', name: 'Ürün', price: '10' }],
      {},
      'generic_csv',
      'products',
    );
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('boş SKU için hata üretmeli', () => {
    const result = validateMigrationRows(
      [{ name: 'Ürün', price: '10' }],
      {},
      'generic_csv',
      'products',
    );
    expect(result.valid).toBe(0);
    expect(result.errors.some((e) => e.field === 'sku')).toBe(true);
  });
});
