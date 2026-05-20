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
  /** Veri taşıma sihirbazı oturumu */
  MIGRATION_SESSION: 86_400,
} as const;
