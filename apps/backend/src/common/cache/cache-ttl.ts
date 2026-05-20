/** Redis önbellek TTL (saniye) — sık okunan / nadiren değişen ayrımı. */
export const CACHE_TTL = {
  /** Dashboard KPI, platform performans */
  DASHBOARD: 300,
  /** Ürün listesi, stok özeti */
  PRODUCT_STOCK: 60,
  /** TCMB / kur */
  EXCHANGE_RATES: 3_600,
  /** Paket limitleri (enum/config) */
  PLAN_LIMITS: 86_400,
  /** Listeleme listesi özeti */
  LISTINGS_SUMMARY: 30,
  /** Amazon LWA access token (55 dk) */
  AMAZON_LWA_TOKEN: 3_300,
  /** Etsy OAuth access token (55 dk) */
  ETSY_OAUTH_TOKEN: 3_300,
  /** Pazaryeri erişim / sertifika token (1 saat) */
  MARKETPLACE_ACCESS_TOKEN: 3_600,
  /** Lazada / Shopee OAuth access token (7 gün) */
  LAZADA_ACCESS_TOKEN: 7 * 24 * 3_600,
  LAZADA_REFRESH_TOKEN: 30 * 24 * 3_600,
  SHOPEE_ACCESS_TOKEN: 7 * 24 * 3_600,
  SHOPEE_REFRESH_TOKEN: 30 * 24 * 3_600,
  /** Veri taşıma sihirbazı oturumu */
  MIGRATION_SESSION: 86_400,
} as const;
