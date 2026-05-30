import {
  filterBizimHesapProductRows,
  normalizeBizimHesapCategoryToken,
  resolveBizimHesapIsEcommerce,
} from './bizimhesap-product-filter.util';

describe('bizimhesap-product-filter', () => {
  it('normalizes Turkish category tokens for comparison', () => {
    expect(normalizeBizimHesapCategoryToken('E-TİCARET')).toBe('e-ticaret');
    expect(normalizeBizimHesapCategoryToken('E-Ticaret')).toBe('e-ticaret');
    expect(normalizeBizimHesapCategoryToken('  Elektrik  ')).toBe('elektrik');
  });

  it('detects isEcommerce from common field variants', () => {
    expect(resolveBizimHesapIsEcommerce({ IsEcommerce: true })).toBe(true);
    expect(resolveBizimHesapIsEcommerce({ isEcommerce: '1' })).toBe(true);
    expect(resolveBizimHesapIsEcommerce({ is_ecommerce: 'true' })).toBe(true);
    expect(resolveBizimHesapIsEcommerce({ Name: 'X' })).toBe(false);
  });

  it('filters ecommerce-only products', () => {
    const rows = [
      { Id: '1', Name: 'A', IsEcommerce: true },
      { Id: '2', Name: 'B', IsEcommerce: false },
      { Id: '3', Name: 'C' },
    ];
    const filtered = filterBizimHesapProductRows(rows, { mode: 'ECOMMERCE_ONLY' });
    expect(filtered.map((row) => row.Id)).toEqual(['1']);
  });

  it('filters by category id or name', () => {
    const rows = [
      { Id: '1', Name: 'A', CategoryId: '10' },
      { Id: '2', Name: 'B', CategoryName: 'Elektrik' },
      { Id: '3', Name: 'C', CategoryId: '99' },
      { Id: '4', Name: 'D', category: 'E-Ticaret' },
    ];
    const filtered = filterBizimHesapProductRows(rows, {
      mode: 'CATEGORY',
      categoryIds: ['10', 'elektrik', 'E-TİCARET'],
    });
    expect(filtered.map((row) => row.Id)).toEqual(['1', '2', '4']);
  });

  it('returns all rows when mode is ALL', () => {
    const rows = [{ Id: '1' }, { Id: '2' }];
    expect(filterBizimHesapProductRows(rows, { mode: 'ALL' })).toHaveLength(2);
  });
});
