import type { ProductImportDto } from '../migration.import-dto';

import { parseDecimal, parseIntSafe, rowGet } from './transformer.util';

export class TicimaxTransformer {
  transformProduct(row: Record<string, string>): ProductImportDto {
    const barcode =
      rowGet(row, [
        'StokKodu',
        'stokkodu',
        'Barkod',
        'barkod',
        'UrunKodu',
        'urunkodu',
      ]) ?? '';
    const name =
      rowGet(row, ['UrunAdi', 'urunadi', 'Ad', 'ad', 'Baslik', 'baslik']) ?? '';
    const price =
      parseDecimal(
        rowGet(row, ['SatisFiyati', 'satisfiyati', 'Fiyat', 'fiyat', 'Price']),
      ) ?? 0;

    return {
      barcode,
      name,
      sku: rowGet(row, ['StokKodu', 'stokkodu']),
      price,
      listPrice:
        parseDecimal(rowGet(row, ['ListeFiyati', 'listefiyati'])) ?? undefined,
      stock: parseIntSafe(rowGet(row, ['Stok', 'stok', 'StokAdedi']), 0),
      category: rowGet(row, ['Kategori', 'kategori', 'KategoriAdi']),
      brand: rowGet(row, ['Marka', 'marka']),
      description: rowGet(row, ['Aciklama', 'aciklama']),
      imageUrl: rowGet(row, ['Resim', 'resim', 'Gorsel', 'gorsel']),
    };
  }
}
