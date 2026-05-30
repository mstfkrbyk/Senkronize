import { resolveBizimHesapProductsArray } from './bizimhesap-product.util';

describe('resolveBizimHesapProductsArray', () => {
  it('returns direct arrays', () => {
    expect(resolveBizimHesapProductsArray([{ id: '1', name: 'A' }])).toEqual([
      { id: '1', name: 'A' },
    ]);
  });

  it('unwraps data arrays', () => {
    expect(
      resolveBizimHesapProductsArray({
        data: [{ productId: '10', productName: 'B' }],
      }),
    ).toEqual([{ productId: '10', productName: 'B' }]);
  });

  it('unwraps nested products objects', () => {
    expect(
      resolveBizimHesapProductsArray({
        data: {
          products: [{ id: '2', name: 'C' }],
        },
      }),
    ).toEqual([{ id: '2', name: 'C' }]);
  });

  it('converts object maps to arrays', () => {
    expect(
      resolveBizimHesapProductsArray({
        '1': { id: '1', name: 'D' },
        '2': { id: '2', name: 'E' },
      }),
    ).toEqual([
      { id: '1', name: 'D' },
      { id: '2', name: 'E' },
    ]);
  });
});
