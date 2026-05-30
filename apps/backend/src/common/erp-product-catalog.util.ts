import { resolveStockBarcode } from './product-match-key';

export interface ErpCatalogInput {
  barcode: string;
  sku?: string | null;
}

export interface ErpCatalogFields {
  catalogBarcode: string;
  catalogSku: string;
  stockKey: string;
}

export interface ProductCatalogWrite {
  barcode: string | null;
  sku: string | null;
}

/** ERP satırından katalog barkod / SKU / stok anahtarı */
export function resolveErpCatalogFields(input: ErpCatalogInput): ErpCatalogFields {
  const catalogBarcode = input.barcode.trim();
  const catalogSku = (input.sku ?? '').trim();
  const stockKey = resolveStockBarcode(catalogBarcode, catalogSku);
  return { catalogBarcode, catalogSku, stockKey };
}

/**
 * Kataloga yazılacak barkod ve SKU.
 * - Gerçek barkod yoksa `barcode` null kalır (SKU barkod alanına kopyalanmaz).
 * - Stok takibi `stockKey` ile yapılır (barkod veya SKU).
 */
export function buildProductCatalogWrite(fields: ErpCatalogFields): ProductCatalogWrite | null {
  const { catalogBarcode, catalogSku, stockKey } = fields;
  if (stockKey.length === 0) {
    return null;
  }

  const barcode = catalogBarcode.length > 0 ? catalogBarcode : null;
  let sku: string | null = catalogSku.length > 0 ? catalogSku : null;

  if (barcode && sku && barcode === sku) {
    sku = null;
  }

  if (!barcode && !sku) {
    return null;
  }

  return { barcode, sku };
}
