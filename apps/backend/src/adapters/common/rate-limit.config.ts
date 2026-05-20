import { LEGACY_PLATFORM_RPM } from './legacy-platform-rpm';

export interface PlatformRateLimit {
  rpm: number;
  burst: number;
}

/** Platform başına token bucket kapasitesi ve dakikalık yenileme hızı. */
export const PLATFORM_RATE_LIMIT_BUCKETS: Record<string, PlatformRateLimit> = {
  TRENDYOL: { rpm: 100, burst: 150 },
  HEPSIBURADA: { rpm: 60, burst: 90 },
  N11: { rpm: 30, burst: 45 },
  AMAZON: { rpm: 60, burst: 100 },
  CICEKSEPETI: { rpm: 60, burst: 90 },
  PAZARAMA: { rpm: 60, burst: 90 },
  PTTAVM: { rpm: 30, burst: 45 },
  SHOPIFY: { rpm: 40, burst: 80 },
  WOOCOMMERCE: { rpm: 120, burst: 150 },
  ETSY: { rpm: 10, burst: 15 },
  OZON: { rpm: 60, burst: 90 },
  WILDBERRIES: { rpm: 300, burst: 350 },
  DEFAULT: { rpm: 60, burst: 60 },
};

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  retryAfterSeconds: number;
}

const AMAZON_PREFIX = 'AMAZON';

export function getPlatformRateLimit(platform: string): PlatformRateLimit {
  const key = platform.toUpperCase();
  if (PLATFORM_RATE_LIMIT_BUCKETS[key]) {
    return PLATFORM_RATE_LIMIT_BUCKETS[key];
  }
  if (key.startsWith(AMAZON_PREFIX)) {
    return PLATFORM_RATE_LIMIT_BUCKETS.AMAZON;
  }
  const legacyRpm = LEGACY_PLATFORM_RPM[key] ?? LEGACY_PLATFORM_RPM.DEFAULT;
  return {
    rpm: legacyRpm,
    burst: Math.max(legacyRpm, PLATFORM_RATE_LIMIT_BUCKETS.DEFAULT.burst),
  };
}

export function getRateLimitConfig(platform: string): RateLimitConfig {
  const { rpm, burst } = getPlatformRateLimit(platform);
  return {
    requestsPerMinute: rpm,
    burstLimit: burst,
    retryAfterSeconds: 60,
  };
}

export function platformRequestsPerMinute(platform: string): number {
  return getRateLimitConfig(platform).requestsPerMinute;
}

/** Adaptörlerin `rpm()` metodları için istek/dakika haritası. */
export const PLATFORM_RATE_LIMIT_RPM: Record<string, number> = (() => {
  const merged: Record<string, number> = { ...LEGACY_PLATFORM_RPM };
  for (const [platform, cfg] of Object.entries(PLATFORM_RATE_LIMIT_BUCKETS)) {
    merged[platform] = cfg.rpm;
  }
  for (const platform of Object.keys(LEGACY_PLATFORM_RPM)) {
    if (platform.startsWith(AMAZON_PREFIX) && platform !== 'AMAZON') {
      merged[platform] = PLATFORM_RATE_LIMIT_BUCKETS.AMAZON.rpm;
    }
  }
  return merged;
})();

/** Adaptör `rpm()` metodları — dakikadaki istek sayısı (geriye dönük uyumlu). */
export const PLATFORM_RATE_LIMITS: Record<string, number> = PLATFORM_RATE_LIMIT_RPM;
