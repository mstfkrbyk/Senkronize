import type { BizimHesapProductRow } from './bizimhesap.types';

/** Yalnızca gerçek barkod alanları — stok kodu (Code) buraya yazılmaz */
export function resolveBizimHesapBarcode(row: BizimHesapProductRow): string {
  return String(row.Barcode ?? row.barcode ?? '').trim();
}

/** Stok / ürün kodu (SKU) — boşsa BizimHesap ürün ID'si kullanılır */
export function resolveBizimHesapSku(row: BizimHesapProductRow): string {
  const code = String(row.Code ?? row.code ?? row.productCode ?? '').trim();
  if (code.length > 0) {
    return code;
  }
  return String(row.Id ?? row.id ?? row.productId ?? row.ProductId ?? '').trim();
}

export function resolveBizimHesapProductId(row: BizimHesapProductRow): string {
  return String(
    row.Id ??
      row.id ??
      row.productId ??
      row.ProductId ??
      row.Code ??
      row.code ??
      row.productCode ??
      '',
  ).trim();
}
