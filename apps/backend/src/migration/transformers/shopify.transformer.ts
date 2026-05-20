import type { ProductImportDto } from '../migration.import-dto';

import { parseDecimal, parseIntSafe, rowGet } from './transformer.util';

export class ShopifyTransformer {
  transformProduct(row: Record<string, string>): ProductImportDto {
    const handle = rowGet(row, ['Handle', 'handle']) ?? '';
    const title = rowGet(row, ['Title', 'title']) ?? '';
    const sku =
      rowGet(row, ['Variant SKU', 'Variant SKU', 'variantsku', 'variant sku']) ??
      handle;
    const price =
      parseDecimal(
        rowGet(row, [
          'Variant Price',
          'Variant Price',
          'variant price',
          'variantprice',
        ]),
      ) ?? 0;
    const stock = parseIntSafe(
      rowGet(row, [
        'Variant Inventory Qty',
        'variant inventory qty',
        'variantinventoryqty',
      ]),
      0,
    );

    return {
      barcode: sku,
      sku,
      name: title,
      price,
      stock,
      imageUrl: rowGet(row, ['Image Src', 'image src', 'imagesrc']),
    };
  }
}
