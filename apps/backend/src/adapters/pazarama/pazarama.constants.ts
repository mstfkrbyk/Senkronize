/** Pazarama Connect API */
export const PAZARAMA_CONNECT_BASE = 'https://isortagim.pazarama.com/connect/v1';

export const PAZARAMA_OAUTH_TOKEN_PATH = '/oauth/token';
export const PAZARAMA_ORDERS_PATH = '/orders';
export const PAZARAMA_UPDATE_PRICE_STOCK_PATH = '/products/update-price-and-quantity';

export function pazaramaOrderCargoPath(orderNumber: string): string {
  return `/orders/${encodeURIComponent(orderNumber)}/cargo`;
}
