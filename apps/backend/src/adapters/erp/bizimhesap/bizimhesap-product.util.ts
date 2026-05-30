import type { BizimHesapProductRow, BizimHesapProductsResponse } from './bizimhesap.types';

function asProductRowArray(value: unknown): BizimHesapProductRow[] {
  if (Array.isArray(value)) {
    return value as BizimHesapProductRow[];
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of ['products', 'Products', 'items', 'Items', 'data', 'Data', 'list', 'List']) {
    if (key in record) {
      const nested = asProductRowArray(record[key]);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  const values = Object.values(record);
  if (
    values.length > 0 &&
    values.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
  ) {
    return values as BizimHesapProductRow[];
  }

  return [];
}

export function resolveBizimHesapProductsArray(
  response: BizimHesapProductsResponse | unknown,
): BizimHesapProductRow[] {
  if (Array.isArray(response)) {
    return response as BizimHesapProductRow[];
  }
  if (!response || typeof response !== 'object') {
    return [];
  }

  const record = response as Record<string, unknown>;
  for (const key of ['data', 'Data', 'products', 'Products', 'items', 'Items']) {
    if (key in record) {
      const rows = asProductRowArray(record[key]);
      if (rows.length > 0) {
        return rows;
      }
    }
  }

  return asProductRowArray(response);
}
