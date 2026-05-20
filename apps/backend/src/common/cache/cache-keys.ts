/** Redis önbellek anahtarı üreticileri — tutarlı isimlendirme. */
export const CacheKeys = {
  dashboard: (orgId: string) => `dashboard:${orgId}`,
  platformStats: (orgId: string) => `stats:platform:${orgId}`,
  listing: (orgId: string, platform?: string) =>
    `listings:${orgId}:${platform ?? 'all'}`,
  product: (orgId: string, productId: string) => `product:${orgId}:${productId}`,
  subscription: (orgId: string) => `subscription:${orgId}`,
  exchangeRates: () => `exchange:rates`,
  buyboxScore: (listingId: string) => `buybox:${listingId}`,
} as const;
