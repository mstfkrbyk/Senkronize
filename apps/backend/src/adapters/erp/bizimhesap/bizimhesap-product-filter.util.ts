import type { ErpProductImportOptions } from '@senkronize/shared';

import type { BizimHesapProductRow } from './bizimhesap.types';

/** BizimHesap kategori adı / ID karşılaştırması — Türkçe İ/i uyumu için tr-TR */
export function normalizeBizimHesapCategoryToken(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function readString(row: BizimHesapProductRow, keys: string[]): string {
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

export function resolveBizimHesapIsEcommerce(row: BizimHesapProductRow): boolean {
  const record = row as Record<string, unknown>;
  for (const key of [
    'IsEcommerce',
    'isEcommerce',
    'is_ecommerce',
    'Ecommerce',
    'ecommerce',
    'IsECommerce',
    'isECommerce',
  ]) {
    const value = record[key];
    if (value === true || value === 1) {
      return true;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'evet') {
        return true;
      }
    }
  }
  return false;
}

export function resolveBizimHesapCategoryId(row: BizimHesapProductRow): string {
  return readString(row, [
    'CategoryId',
    'categoryId',
    'category_id',
    'CategoryID',
    'StockCategoryId',
    'stockCategoryId',
    'KategoriId',
    'kategoriId',
  ]);
}

export function resolveBizimHesapCategoryName(row: BizimHesapProductRow): string {
  return readString(row, [
    'category',
    'Category',
    'CategoryName',
    'categoryName',
    'category_name',
    'KategoriAdi',
    'kategoriAdi',
    'Kategori',
    'kategori',
    'StockCategoryName',
    'stockCategoryName',
  ]);
}

function matchesCategoryFilter(
  row: BizimHesapProductRow,
  categoryIds: string[],
): boolean {
  if (categoryIds.length === 0) {
    return false;
  }
  const normalized = new Set(
    categoryIds.map((id) => normalizeBizimHesapCategoryToken(id)).filter(Boolean),
  );
  const categoryId = normalizeBizimHesapCategoryToken(resolveBizimHesapCategoryId(row));
  const categoryName = normalizeBizimHesapCategoryToken(resolveBizimHesapCategoryName(row));
  if (categoryId.length > 0 && normalized.has(categoryId)) {
    return true;
  }
  if (categoryName.length > 0 && normalized.has(categoryName)) {
    return true;
  }
  return false;
}

export function filterBizimHesapProductRows(
  rows: BizimHesapProductRow[],
  options?: ErpProductImportOptions,
): BizimHesapProductRow[] {
  if (!options || options.mode === 'ALL') {
    return rows;
  }
  if (options.mode === 'ECOMMERCE_ONLY') {
    return rows.filter((row) => resolveBizimHesapIsEcommerce(row));
  }
  const categoryIds = options.categoryIds ?? [];
  return rows.filter((row) => matchesCategoryFilter(row, categoryIds));
}
