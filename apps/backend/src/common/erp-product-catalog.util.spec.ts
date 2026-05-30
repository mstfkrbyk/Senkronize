import {
  buildProductCatalogWrite,
  resolveErpCatalogFields,
} from './erp-product-catalog.util';

describe('erp-product-catalog.util', () => {
  it('separates EAN barcode and stock code', () => {
    const fields = resolveErpCatalogFields({
      barcode: '4058075198663',
      sku: 'MIXPHILIPS4588',
    });
    expect(buildProductCatalogWrite(fields)).toEqual({
      barcode: '4058075198663',
      sku: 'MIXPHILIPS4588',
    });
  });

  it('does not duplicate EAN into sku when only barcode exists', () => {
    const fields = resolveErpCatalogFields({
      barcode: '8680998214424',
      sku: '',
    });
    expect(buildProductCatalogWrite(fields)).toEqual({
      barcode: '8680998214424',
      sku: null,
    });
  });

  it('keeps barcode null when ERP has only stock code', () => {
    const fields = resolveErpCatalogFields({
      barcode: '',
      sku: '313411',
    });
    expect(buildProductCatalogWrite(fields)).toEqual({
      barcode: null,
      sku: '313411',
    });
  });

  it('avoids duplicate sku when barcode and sku are identical', () => {
    const fields = resolveErpCatalogFields({
      barcode: '8680998214424',
      sku: '8680998214424',
    });
    expect(buildProductCatalogWrite(fields)).toEqual({
      barcode: '8680998214424',
      sku: null,
    });
  });
});
