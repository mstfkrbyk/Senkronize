import { EntegraTransformer } from './entegra.transformer';
import { ShopifyTransformer } from './shopify.transformer';
import { WooCommerceTransformer } from './woocommerce.transformer';

describe('Migration transformers', () => {
  const entegra = new EntegraTransformer();
  const woo = new WooCommerceTransformer();
  const shopify = new ShopifyTransformer();

  it('EntegraTransformer ürün dönüştürmeli', () => {
    const dto = entegra.transformProduct({
      barkod: 'E001',
      urun_adi: 'Test Ürün',
      fiyat: '99,50',
      stok: '5',
    });
    expect(dto).toMatchObject({
      barcode: 'E001',
      name: 'Test Ürün',
      price: 99.5,
      stock: 5,
    });
  });

  it('WooCommerceTransformer ürün dönüştürmeli', () => {
    const dto = woo.transformProduct({
      post_title: 'WC Ürün',
      _sku: 'WC-SKU',
      _price: '120',
      _stock: '3',
    });
    expect(dto).toMatchObject({
      barcode: 'WC-SKU',
      name: 'WC Ürün',
      price: 120,
      stock: 3,
    });
  });

  it('ShopifyTransformer ürün dönüştürmeli', () => {
    const dto = shopify.transformProduct({
      Handle: 'my-product',
      Title: 'Shopify Ürün',
      'Variant SKU': 'SH-1',
      'Variant Price': '250',
      'Variant Inventory Qty': '12',
    });
    expect(dto).toMatchObject({
      sku: 'SH-1',
      name: 'Shopify Ürün',
      price: 250,
      stock: 12,
    });
  });
});
