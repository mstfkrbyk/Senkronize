/** Redis önbellek anahtarı üreticileri — tutarlı isimlendirme. */
export const CacheKeys = {
  dashboard: (orgId: string) => `dashboard:${orgId}`,
  dashboardKpis: (orgId: string, period: string) =>
    `dashboard:kpis:${orgId}:${period}`,
  platformPerformance: (orgId: string, period: string) =>
    `platform:performance:${orgId}:${period}`,
  productsList: (orgId: string, filterHash: string) =>
    `products:list:${orgId}:${filterHash}`,
  stockSummary: (orgId: string) => `stock:summary:${orgId}`,
  planLimits: () => `plan:limits`,
  platformStats: (orgId: string) => `stats:platform:${orgId}`,
  listing: (orgId: string, platform?: string) =>
    `listings:${orgId}:${platform ?? 'all'}`,
  product: (orgId: string, productId: string) => `product:${orgId}:${productId}`,
  subscription: (orgId: string) => `subscription:${orgId}`,
  apiCallsDaily: (orgId: string, dateKey: string) =>
    `usage:api_calls:${orgId}:${dateKey}`,
  exchangeRates: () => `exchange:rates`,
  buyboxScore: (listingId: string) => `buybox:${listingId}`,
  migrationSession: (sessionId: string) => `migration:session:${sessionId}`,
  adminStatsPlatform: (product: string) => `admin:stats:platform:${product}`,
  adminStatsRevenue: () => `admin:stats:revenue`,
  adminStatsGrowth: (period: string) => `admin:stats:growth:${period}`,
  adminStatsMrrHistory: () => `admin:stats:mrr-history`,
  adminStatsPlatformUsage: () => `admin:stats:platform-usage`,
  adminStatsCohort: () => `admin:stats:cohort-retention`,
} as const;
