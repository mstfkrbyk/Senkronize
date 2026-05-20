/** Trendyol Supplier API (SAPIGW) */
export const TRENDYOL_SAPIGW_BASE = 'https://api.trendyol.com/sapigw/suppliers';

/** V2 entegrasyon API (uluslararası kanallar) */
export const TRENDYOL_BASE_URL = 'https://apigw.trendyol.com/integration';

export const TRENDYOL_ORDERS = '/orders';
export const TRENDYOL_PRODUCTS = '/products';
export const TRENDYOL_PRODUCTS_V2 = '/v2/products';
export const TRENDYOL_PRICE_INVENTORY = '/products/price-and-inventory';

export function trendyolShipmentPackagePath(shipmentPackageId: string): string {
  return `/shipment-packages/${encodeURIComponent(shipmentPackageId)}`;
}

export function trendyolOrderPackagePath(orderId: string): string {
  return `/orders/${encodeURIComponent(orderId)}/package`;
}

/** Trendyol kargo sağlayıcı kodları */
export const TRENDYOL_CARGO_PROVIDERS = ['YURTICI', 'ARAS', 'MNG'] as const;
export type TrendyolCargoProvider = (typeof TRENDYOL_CARGO_PROVIDERS)[number];

export const TRENDYOL_SELLER_ORDERS = '/order/sellers/{sellerId}/orders';
export const TRENDYOL_V2_PRODUCTS = '/product/sellers/{sellerId}/products';
export const TRENDYOL_STOCK_UPDATE =
  '/inventory/sellers/{sellerId}/products/price-and-inventory';
export const TRENDYOL_SHIPMENT_PROVIDERS =
  '/order/sellers/{sellerId}/shipment-providers';
export const TRENDYOL_BRANDS = '/product/brands';
export const TRENDYOL_CATEGORIES = '/product/product-categories';

/** V2 zorunlu User-Agent: `{sellerId} - SelfIntegration` */
export const TRENDYOL_USER_AGENT_SUFFIX = 'SelfIntegration';

export const TRENDYOL_WEBHOOK_EVENTS = [
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'PACKAGE_STATUS_CHANGED',
  'PRODUCT_APPROVED',
  'PRODUCT_REJECTED',
] as const;

export type TrendyolWebhookEvent = (typeof TRENDYOL_WEBHOOK_EVENTS)[number];

export function trendyolSellerPath(template: string, sellerId: string): string {
  return template.replaceAll('{sellerId}', sellerId);
}

export function trendyolSupplierBaseUrl(supplierId: string): string {
  return `${TRENDYOL_SAPIGW_BASE}/${encodeURIComponent(supplierId)}`;
}
