export const HEPSIBURADA_LISTING_BASE_URL =
  'https://listing-external.hepsiburada.com';
/** Sipariş ve paket işlemleri (MPOP) */
export const HEPSIBURADA_OMS_BASE_URL = 'https://mpop.hepsiburada.com';
export const HEPSIBURADA_MPOP_PRODUCT_SERVICE = '/product-service/api';
export const HEPSIBURADA_INTEGRATION_ID =
  process.env.HEPSIBURADA_INTEGRATION_ID ?? 'senkronize';

export function hepsiburadaOrderSummariesPath(merchantId: string): string {
  return `/listings/merchantid/${encodeURIComponent(merchantId)}/summaries`;
}

export function hepsiburadaBatchRequestsPath(merchantId: string): string {
  return `/listings/merchantid/${encodeURIComponent(merchantId)}/batch/requests`;
}

export function hepsiburadaOrderShippingPath(orderNumber: string): string {
  return `${HEPSIBURADA_MPOP_PRODUCT_SERVICE}/orders/${encodeURIComponent(orderNumber)}/shipping`;
}

export function hepsiburadaMerchantOrdersPath(merchantId: string): string {
  return `${HEPSIBURADA_MPOP_PRODUCT_SERVICE}/merchants/${encodeURIComponent(merchantId)}/orders`;
}

export function hepsiburadaMerchantPackagesPath(merchantId: string): string {
  return `${HEPSIBURADA_MPOP_PRODUCT_SERVICE}/merchants/${encodeURIComponent(merchantId)}/packages`;
}

export function hepsiburadaPackageShippingPath(
  merchantId: string,
  packageNumber: string,
): string {
  return `${HEPSIBURADA_MPOP_PRODUCT_SERVICE}/merchants/${encodeURIComponent(merchantId)}/packages/${encodeURIComponent(packageNumber)}/shipping`;
}

export function hepsiburadaBatchRequestStatusPath(
  merchantId: string,
  batchId: string,
): string {
  return `/listings/merchantid/${encodeURIComponent(merchantId)}/batch/requests/${encodeURIComponent(batchId)}`;
}

export const HEPSIBURADA_MERCHANT_PRODUCTS_PATH =
  `${HEPSIBURADA_MPOP_PRODUCT_SERVICE}/products/merchantProducts`;
