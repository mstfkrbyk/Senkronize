import type { OrderImportDto, ProductImportDto } from '../migration.import-dto';

import { parseDecimal, parseIntSafe, rowGet } from './transformer.util';

export class EntegraTransformer {
  transformProduct(row: Record<string, string>): ProductImportDto {
    const barcode =
      rowGet(row, [
        'barkod',
        'barcode',
        'urun_kodu',
        'urunkodu',
        'entegraurunkodu',
        'sku',
      ]) ?? '';
    const name =
      rowGet(row, ['urun_adi', 'urunadi', 'name', 'baslik', 'title']) ?? '';
    const price =
      parseDecimal(
        rowGet(row, ['fiyat', 'satisfiyati', 'sale_price', 'price', 'satis_fiyati']),
      ) ?? 0;

    return {
      barcode,
      name,
      sku: rowGet(row, ['sku', 'stok_kodu', 'stokkodu']),
      price,
      listPrice:
        parseDecimal(rowGet(row, ['liste_fiyati', 'listprice', 'list_price'])) ??
        undefined,
      stock: parseIntSafe(rowGet(row, ['stok', 'stock', 'miktar']), 0),
      category: rowGet(row, ['kategori', 'category']),
      brand: rowGet(row, ['marka', 'brand']),
      description: rowGet(row, ['aciklama', 'description']),
      imageUrl: rowGet(row, ['resim', 'image', 'imageurl', 'gorsel']),
    };
  }

  transformOrder(row: Record<string, string>): OrderImportDto {
    const platformOrderId =
      rowGet(row, ['siparis_no', 'siparisno', 'order_id', 'orderid']) ?? '';
    const platform = rowGet(row, ['platform', 'pazaryeri']) ?? 'TRENDYOL';
    const totalAmount =
      parseDecimal(rowGet(row, ['tutar', 'total', 'toplam', 'total_amount'])) ?? 0;

    const itemSku = rowGet(row, ['urun_kodu', 'sku', 'stok_kodu']) ?? '';
    const itemBarcode = rowGet(row, ['barkod', 'barcode']) ?? itemSku;
    const qty = parseIntSafe(rowGet(row, ['adet', 'quantity', 'miktar']), 1);
    const unitPrice =
      parseDecimal(rowGet(row, ['birim_fiyat', 'unit_price', 'fiyat'])) ?? 0;

    return {
      platformOrderId,
      platform: platform.toUpperCase().replace(/\s/g, '_'),
      orderDate:
        rowGet(row, ['tarih', 'order_date', 'siparis_tarihi']) ??
        new Date().toISOString(),
      customerName:
        rowGet(row, ['musteri', 'musteri_adi', 'customer_name', 'alici']) ?? 'Müşteri',
      customerEmail: rowGet(row, ['email', 'eposta', 'musteri_email']),
      customerPhone: rowGet(row, ['telefon', 'phone']),
      shippingAddress: rowGet(row, ['adres', 'shipping_address']),
      totalAmount,
      cargoTrackingNumber: rowGet(row, ['kargo_takip', 'tracking_number']),
      cargoProvider: rowGet(row, ['kargo_firma', 'cargo_provider']),
      items: [
        {
          sku: itemSku,
          barcode: itemBarcode,
          productName: rowGet(row, ['urun_adi', 'product_name']),
          quantity: qty,
          unitPrice,
        },
      ],
    };
  }
}
