/** Pazarama Integration API */
export const PAZARAMA_API_BASE =
  'https://isortagim.pazarama.com/integration/api/v1';

export const PAZARAMA_TOKEN_PATH = '/account/token';
export const PAZARAMA_ORDERS_PATH = '/orders';
export const PAZARAMA_PRODUCTS_PATH = '/products';
export const PAZARAMA_SHIPMENT_PATH = '/orders/shipment';
export const PAZARAMA_STOCK_PATH = '/products/stock';
export const PAZARAMA_PRICE_PATH = '/products/price';

export const PAZARAMA_ORDER_STATUS_CREATED = 'Created';

/** Pazarama kargo firma kodları */
export const PAZARAMA_CARGO_CODES = {
  YURTICI: 'YK',
  MNG: 'MNG',
  ARAS: 'ARS',
  PTT: 'PTT',
  SURAT: 'SRT',
} as const;

export type PazaramaCargoCode =
  (typeof PAZARAMA_CARGO_CODES)[keyof typeof PAZARAMA_CARGO_CODES];

export function pazaramaOrderDetailPath(orderNumber: string): string {
  return `/orders/${encodeURIComponent(orderNumber)}`;
}
