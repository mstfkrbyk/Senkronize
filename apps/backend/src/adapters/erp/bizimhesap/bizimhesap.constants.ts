export const BIZIMHESAP_BASE_URL = 'https://bizimhesap.com/api/b2b';

/** BizimHesap tarafından tüm entegrasyonlar için verilen sabit API anahtarı */
export const BIZIMHESAP_FIXED_KEY = 'BZMHB2B724018943908D0B82491F203F';

export const BIZIMHESAP_DEFAULT_VAT_RATE = 18;

/** BizimHesap API kotası: saatte en fazla ~10 istek (platform kararı). */
export const BIZIMHESAP_MAX_REQUESTS_PER_HOUR = 10;
export const BIZIMHESAP_MIN_SYNC_INTERVAL_MS =
  (60 * 60 * 1000) / BIZIMHESAP_MAX_REQUESTS_PER_HOUR;
