/** Trendyol SAPIGW uluslararası tedarikçi API */
export const TRENDYOL_INT_SAPIGW_BASE =
  'https://api.trendyol.com/sapigw-international/suppliers';

export function trendyolInternationalSupplierBaseUrl(supplierId: string): string {
  return `${TRENDYOL_INT_SAPIGW_BASE}/${encodeURIComponent(supplierId)}`;
}
