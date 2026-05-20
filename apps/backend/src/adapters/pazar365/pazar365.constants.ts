export const PAZAR365_API_BASE = 'https://api.pazar365.com/v1';

export const PAZAR365_ORDERS_PATH = '/orders';
export const PAZAR365_PRODUCTS_PATH = '/products';

export function pazar365ProductPricePath(productCode: string): string {
  return `/products/${encodeURIComponent(productCode)}/price`;
}

export function pazar365ProductStockPath(productCode: string): string {
  return `/products/${encodeURIComponent(productCode)}/stock`;
}

export function pazar365OrderCargoPath(orderId: string): string {
  return `/orders/${encodeURIComponent(orderId)}/cargo`;
}
