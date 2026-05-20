import type { ProductImportDto } from '../migration.import-dto';

import { parseDecimal, parseIntSafe, rowGet } from './transformer.util';

export class WooCommerceTransformer {
  transformProduct(row: Record<string, string>): ProductImportDto {
    const barcode =
      rowGet(row, ['_sku', 'sku', 'barcode', 'barkod']) ??
      rowGet(row, ['post_id', 'id']) ??
      '';
    const name =
      rowGet(row, ['post_title', 'title', 'name', 'ürün adı']) ?? '';
    const price =
      parseDecimal(
        rowGet(row, ['_regular_price', '_price', 'price', 'regular_price']),
      ) ?? 0;

    return {
      barcode,
      name,
      sku: rowGet(row, ['_sku', 'sku']),
      price,
      stock: parseIntSafe(rowGet(row, ['_stock', 'stock', 'quantity']), 0),
      category: rowGet(row, ['category', 'kategori']),
      description: rowGet(row, ['post_content', 'description']),
      imageUrl: rowGet(row, ['image_url', 'image', 'gorsel']),
    };
  }
}
