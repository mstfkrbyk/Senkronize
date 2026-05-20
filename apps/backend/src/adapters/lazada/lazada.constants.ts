/** Lazada Open Platform — OAuth ve API uçları */
export const LAZADA_AUTH_BASE = 'https://auth.lazada.com';
export const LAZADA_AUTH_REST = `${LAZADA_AUTH_BASE}/rest`;
export const LAZADA_API_BASE = 'https://api.lazada.com.my/rest';
export const LAZADA_AUTHORIZE_URL = `${LAZADA_AUTH_BASE}/oauth/authorize`;

/** Redis TTL: erişim tokenı 7 gün */
export const LAZADA_ACCESS_TOKEN_TTL_SEC = 7 * 24 * 3_600;
/** Redis TTL: yenileme tokenı 30 gün */
export const LAZADA_REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3_600;

export const LAZADA_ORDER_BATCH_SIZE = 50;
