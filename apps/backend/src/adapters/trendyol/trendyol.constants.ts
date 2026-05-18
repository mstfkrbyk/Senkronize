// V2 API (V1 10 Ağustos 2026'da deprecated)
export const TRENDYOL_BASE_URL = 'https://apigw.trendyol.com/integration';

export const TRENDYOL_SELLER_ORDERS = '/order/sellers/{sellerId}/orders';
export const TRENDYOL_PRODUCTS = '/product/sellers/{sellerId}/products';
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
