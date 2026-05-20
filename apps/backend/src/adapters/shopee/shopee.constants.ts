/** Shopee Open Platform v2 */
export const SHOPEE_PARTNER_BASE = 'https://partner.shopeemobile.com';

/** Redis TTL: erişim tokenı 7 gün */
export const SHOPEE_ACCESS_TOKEN_TTL_SEC = 7 * 24 * 3_600;
/** Redis TTL: yenileme tokenı 30 gün */
export const SHOPEE_REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3_600;

export const SHOPEE_ORDER_BATCH_SIZE = 50;

/** Sipariş listesi — senkron için kullanılan durumlar */
export const SHOPEE_ORDER_SYNC_STATUSES = [
  'UNPAID',
  'READY_TO_SHIP',
  'PROCESSED',
  'SHIPPED',
  'COMPLETED',
  'IN_CANCEL',
  'CANCELLED',
] as const;
