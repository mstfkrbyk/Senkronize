import type { BizimHesapProductRow } from './bizimhesap.types';

const NAME_FIELD_KEYS = [
  'Name',
  'name',
  'productName',
  'ProductName',
  'Title',
  'title',
  'StockName',
  'stockName',
  'StokAdi',
  'stokAdi',
  'UrunAdi',
  'urunAdi',
  'ProductTitle',
  'productTitle',
  'Description',
  'description',
  'Aciklama',
  'aciklama',
] as const;

const NAME_KEY_PATTERN = /name|title|adi|desc|aciklama|urun|stok/i;

function pickString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

export function resolveBizimHesapProductName(
  row: BizimHesapProductRow,
  barcodeFallback = '',
): string {
  for (const key of NAME_FIELD_KEYS) {
    const name = pickString(row[key]);
    if (name.length > 0) {
      return name;
    }
  }

  for (const [key, value] of Object.entries(row)) {
    if (!NAME_KEY_PATTERN.test(key)) {
      continue;
    }
    const name = pickString(value);
    if (name.length > 0) {
      return name;
    }
  }

  const fallback = barcodeFallback.trim();
  return fallback.length > 0 ? fallback : 'Ürün';
}
