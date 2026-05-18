import type { MigrationRow } from './migration.types';

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s/g, '').replace(/^\uFEFF/, '');
}

export function parseCsvRows(csv: string): MigrationRow[] {
  const trimmed = csv.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => normalizeHeader(h));

  const getCol = (row: string[], keys: string[]): string | undefined => {
    for (const key of keys) {
      const idx = headers.indexOf(key);
      if (idx >= 0) {
        return row[idx]?.trim();
      }
    }
    return undefined;
  };

  return lines.slice(1).map((line) => {
    const cols = line.split(sep);
    const saleRaw = getCol(cols, [
      'saleprice',
      'satisfiyati',
      'satışfiyatı',
      'fiyat',
      'price',
    ]);
    const listRaw = getCol(cols, [
      'listprice',
      'listeprice',
      'listefiyat',
      'normalprice',
    ]);
    const stockRaw = getCol(cols, ['stock', 'stok', 'quantity', 'miktar']);

    const salePrice = Number.parseFloat(saleRaw ?? '0');
    const listPriceParsed = Number.parseFloat(listRaw ?? '');
    const stockParsed = Number.parseInt(stockRaw ?? '0', 10);

    return {
      barcode: getCol(cols, ['barcode', 'barkod', 'sku']) ?? '',
      name:
        getCol(cols, [
          'name',
          'ad',
          'ürün',
          'urun',
          'ürünadı',
          'urunadi',
          'isim',
          'productname',
          'baslik',
        ]) ?? '',
      salePrice: Number.isFinite(salePrice) ? salePrice : 0,
      listPrice:
        Number.isFinite(listPriceParsed) && listPriceParsed > 0
          ? listPriceParsed
          : undefined,
      stock: Number.isFinite(stockParsed) ? stockParsed : 0,
      category: getCol(cols, ['category', 'kategori']),
      brand: getCol(cols, ['brand', 'marka']),
      description: getCol(cols, ['description', 'aciklama', 'açıklama']),
      imageUrl: getCol(cols, ['imageurl', 'gorsel', 'resim', 'url']),
    };
  })
    .filter((row) => row.barcode.length > 0 && row.name.length > 0);
}
