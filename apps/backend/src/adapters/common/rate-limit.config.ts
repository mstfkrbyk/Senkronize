import { LEGACY_PLATFORM_RPM } from './legacy-platform-rpm';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit?: number;
  retryAfterSeconds: number;
}

/** Platform API hız limitleri (öncelikli konfigürasyon). */
export const PLATFORM_RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  TRENDYOL: { requestsPerMinute: 30, retryAfterSeconds: 60 },
  HEPSIBURADA: { requestsPerMinute: 20, retryAfterSeconds: 60 },
  N11: { requestsPerMinute: 15, requestsPerHour: 500, retryAfterSeconds: 120 },
  AMAZON: { requestsPerMinute: 60, burstLimit: 100, retryAfterSeconds: 30 },
  ETSY: { requestsPerMinute: 10, requestsPerDay: 2000, retryAfterSeconds: 300 },
  SHOPIFY: { requestsPerMinute: 40, burstLimit: 80, retryAfterSeconds: 10 },
  OZON: { requestsPerMinute: 60, retryAfterSeconds: 30 },
  WILDBERRIES: { requestsPerMinute: 300, retryAfterSeconds: 10 },
  DEFAULT: { requestsPerMinute: 10, retryAfterSeconds: 60 },
};

const AMAZON_PREFIX = 'AMAZON';

export function getRateLimitConfig(platform: string): RateLimitConfig {
  const key = platform.toUpperCase();
  if (PLATFORM_RATE_LIMIT_CONFIGS[key]) {
    return PLATFORM_RATE_LIMIT_CONFIGS[key];
  }
  if (key.startsWith(AMAZON_PREFIX)) {
    return PLATFORM_RATE_LIMIT_CONFIGS.AMAZON;
  }
  const legacyRpm = LEGACY_PLATFORM_RPM[key] ?? LEGACY_PLATFORM_RPM.DEFAULT;
  return {
    requestsPerMinute: legacyRpm,
    retryAfterSeconds: PLATFORM_RATE_LIMIT_CONFIGS.DEFAULT.retryAfterSeconds,
  };
}

export function platformRequestsPerMinute(platform: string): number {
  return getRateLimitConfig(platform).requestsPerMinute;
}

/** Adaptörlerin `rpm()` metodları için istek/dakika haritası (geriye dönük uyumlu). */
export const PLATFORM_RATE_LIMITS: Record<string, number> = (() => {
  const merged: Record<string, number> = { ...LEGACY_PLATFORM_RPM };
  for (const [platform, cfg] of Object.entries(PLATFORM_RATE_LIMIT_CONFIGS)) {
    merged[platform] = cfg.requestsPerMinute;
  }
  for (const platform of Object.keys(LEGACY_PLATFORM_RPM)) {
    if (platform.startsWith(AMAZON_PREFIX) && platform !== 'AMAZON') {
      merged[platform] = PLATFORM_RATE_LIMIT_CONFIGS.AMAZON.requestsPerMinute;
    }
  }
  return merged;
})();
