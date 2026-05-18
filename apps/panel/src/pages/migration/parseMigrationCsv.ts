export interface MigrationCsvRow {
  barcode: string;
  name: string;
  category?: string;
  brand?: string;
  salePrice: number;
  listPrice?: number;
  stock?: number;
  description?: string;
  imageUrl?: string;
}

export interface MigrationImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s/g, '').replace(/^\uFEFF/, '');
}

export function parseMigrationCsv(csv: string): MigrationCsvRow[] {
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
    const saleRaw = getCol(cols, ['saleprice', 'satisfiyati', 'fiyat', 'price']);
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
  });
}

export const MIGRATION_CSV_TEMPLATE = `barkod,ad,fiyat,stok,kategori,marka,liste fiyat,aciklama
8690123456789,Örnek Ürün,199.90,15,Elektronik,Marka A,249.90,Örnek açıklama`;
