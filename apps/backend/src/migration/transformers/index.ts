import type { MigrationSourceFormat } from '../migration.types';
import type {
  CustomerImportDto,
  OrderImportDto,
  ProductImportDto,
  StockMovementImportDto,
} from '../migration.import-dto';

import { EntegraTransformer } from './entegra.transformer';
import { ShopifyTransformer } from './shopify.transformer';
import { TicimaxTransformer } from './ticimax.transformer';
import { parseDecimal, parseIntSafe, rowGet } from './transformer.util';
import { WooCommerceTransformer } from './woocommerce.transformer';

const entegra = new EntegraTransformer();
const woo = new WooCommerceTransformer();
const shopify = new ShopifyTransformer();
const ticimax = new TicimaxTransformer();

function genericProduct(row: Record<string, string>): ProductImportDto {
  const barcode =
    rowGet(row, ['barcode', 'barkod', 'sku', 'stokkodu']) ?? '';
  const name =
    rowGet(row, ['name', 'ad', 'urun', 'urunadi', 'baslik', 'title']) ?? '';
  const price =
    parseDecimal(
      rowGet(row, ['price', 'fiyat', 'saleprice', 'satisfiyati', 'satis_fiyati']),
    ) ?? 0;

  return {
    barcode,
    name,
    sku: rowGet(row, ['sku', 'stokkodu']),
    price,
    listPrice:
      parseDecimal(rowGet(row, ['listprice', 'listefiyat', 'liste_fiyati'])) ??
      undefined,
    stock: parseIntSafe(rowGet(row, ['stock', 'stok', 'quantity']), 0),
    category: rowGet(row, ['category', 'kategori']),
    brand: rowGet(row, ['brand', 'marka']),
    description: rowGet(row, ['description', 'aciklama']),
    imageUrl: rowGet(row, ['imageurl', 'gorsel', 'resim', 'url']),
  };
}

function genericOrder(row: Record<string, string>): OrderImportDto {
  const platformOrderId =
    rowGet(row, ['platformorderid', 'order_id', 'siparis_no', 'id']) ?? '';
  const itemSku = rowGet(row, ['itemsku', 'sku']) ?? '';
  const itemBarcode = rowGet(row, ['itembarcode', 'barcode', 'barkod']) ?? itemSku;

  return {
    platformOrderId,
    platform: (rowGet(row, ['platform', 'pazaryeri']) ?? 'TRENDYOL')
      .toUpperCase()
      .replace(/\s/g, '_'),
    orderDate:
      rowGet(row, ['orderdate', 'tarih', 'date']) ?? new Date().toISOString(),
    customerName: rowGet(row, ['customername', 'musteri', 'alici']) ?? 'Müşteri',
    customerEmail: rowGet(row, ['customeremail', 'email']),
    totalAmount:
      parseDecimal(rowGet(row, ['totalamount', 'tutar', 'total'])) ?? 0,
    items: [
      {
        sku: itemSku,
        barcode: itemBarcode,
        productName: rowGet(row, ['itemname', 'urun_adi']),
        quantity: parseIntSafe(rowGet(row, ['itemquantity', 'adet']), 1),
        unitPrice:
          parseDecimal(rowGet(row, ['itemunitprice', 'birim_fiyat'])) ?? 0,
      },
    ],
  };
}

function genericCustomer(row: Record<string, string>): CustomerImportDto {
  return {
    name: rowGet(row, ['name', 'ad', 'musteri']) ?? '',
    email: rowGet(row, ['email', 'eposta']),
    phone: rowGet(row, ['phone', 'telefon']),
    platform: rowGet(row, ['platform', 'pazaryeri']),
    externalId: rowGet(row, ['externalid', 'id', 'musteri_id']),
  };
}

function genericStockMovement(
  row: Record<string, string>,
): StockMovementImportDto {
  const typeRaw = (rowGet(row, ['movementtype', 'tip', 'type']) ?? 'in').toLowerCase();
  return {
    barcode: rowGet(row, ['barcode', 'barkod', 'sku']) ?? '',
    movementType: typeRaw === 'out' || typeRaw === 'cikis' ? 'out' : 'in',
    quantity: parseIntSafe(rowGet(row, ['quantity', 'miktar', 'adet']), 0),
    date: rowGet(row, ['date', 'tarih']),
    note: rowGet(row, ['note', 'aciklama']),
    platform: rowGet(row, ['platform', 'pazaryeri']),
  };
}

export function transformRow(
  sourceFormat: MigrationSourceFormat,
  dataType: 'products' | 'orders' | 'stock_movements' | 'customers',
  row: Record<string, string>,
):
  | ProductImportDto
  | OrderImportDto
  | CustomerImportDto
  | StockMovementImportDto {
  if (dataType === 'products') {
    switch (sourceFormat) {
      case 'entegra_json':
        return entegra.transformProduct(row);
      case 'woocommerce_xml':
      case 'woocommerce_csv':
        return woo.transformProduct(row);
      case 'shopify_csv':
        return shopify.transformProduct(row);
      case 'ticimax_csv':
        return ticimax.transformProduct(row);
      default:
        return genericProduct(row);
    }
  }

  if (dataType === 'orders') {
    if (sourceFormat === 'entegra_json') {
      return entegra.transformOrder(row);
    }
    return genericOrder(row);
  }

  if (dataType === 'customers') {
    return genericCustomer(row);
  }

  return genericStockMovement(row);
}
