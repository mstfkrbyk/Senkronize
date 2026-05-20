/** Daraz Open Platform (Lazada uyumlu) — OAuth ve bölgesel iş API uçları */
export const DARAZ_AUTH_BASE = 'https://auth.daraz.com';
export const DARAZ_AUTH_REST = 'https://api.daraz.com/rest';
export const DARAZ_AUTHORIZE_URL = `${DARAZ_AUTH_BASE}/oauth/authorize`;

/** Sri Lanka varsayılan iş API */
export const DARAZ_API_BASE = 'https://api.daraz.lk/rest';

export type DarazCountryCode = 'pk' | 'bd' | 'lk' | 'np';

export const DARAZ_COUNTRY_API_BASE: Record<DarazCountryCode, string> = {
  pk: 'https://api.daraz.pk/rest',
  bd: 'https://api.daraz.com.bd/rest',
  lk: 'https://api.daraz.lk/rest',
  np: 'https://api.daraz.com.np/rest',
};

/** Redis TTL: erişim tokenı 7 gün */
export const DARAZ_ACCESS_TOKEN_TTL_SEC = 7 * 24 * 3_600;
/** Redis TTL: yenileme tokenı 30 gün */
export const DARAZ_REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3_600;

export const DARAZ_ORDER_BATCH_SIZE = 50;
