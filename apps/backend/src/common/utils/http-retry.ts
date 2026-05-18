import { Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const logger = new Logger('HttpRetry');

export interface RetryOptions {
  maxRetries?: number; // Varsayılan: 3
  backoffMs?: number; // Varsayılan: 1000 (exponential: 1s, 2s, 4s)
  retryOn?: number[]; // HTTP status kodları (varsayılan: [429, 500, 502, 503, 504])
  onRetry?: (attempt: number, error: Error) => void;
}

export async function axiosWithRetry<T>(
  config: AxiosRequestConfig,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    retryOn = [429, 500, 502, 503, 504],
  } = options;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await axios(config);
      return response.data as T;
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;
      const isLastAttempt = attempt > maxRetries;

      if (isLastAttempt || (status && !retryOn.includes(status))) {
        throw err;
      }

      const retryAfterHeader = error.response?.headers?.['retry-after'];
      let waitMs = backoffMs * Math.pow(2, attempt - 1);
      if (retryAfterHeader !== undefined) {
        const raw = Array.isArray(retryAfterHeader)
          ? retryAfterHeader[0]
          : retryAfterHeader;
        const parsed = parseInt(String(raw), 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          waitMs = parsed * 1000;
        }
      }

      logger.warn(
        `HTTP ${String(status)} → ${String(attempt)}. deneme sonrası ${String(waitMs)}ms bekleniyor`,
      );
      options.onRetry?.(attempt, error);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error('Max retry exceeded');
}

type RateLimiterState = { tokens: number; lastTs: number };

// Rate limit per platform (basit in-memory token bucket)
const rateLimiters = new Map<string, RateLimiterState>();

export async function withRateLimit(
  platform: string,
  requestsPerMinute: number,
  fn: () => Promise<void>,
): Promise<void> {
  const now = Date.now();
  const prev = rateLimiters.get(platform) ?? {
    tokens: requestsPerMinute,
    lastTs: now,
  };
  const elapsedMin = (now - prev.lastTs) / 60_000;
  let tokens = Math.min(
    requestsPerMinute,
    prev.tokens + elapsedMin * requestsPerMinute,
  );
  let lastTs = now;

  if (tokens < 1) {
    const need = 1 - tokens;
    const waitMs = (need / requestsPerMinute) * 60_000;
    logger.warn(
      `${platform} rate limit → ${String(Math.ceil(waitMs / 1000))}s bekleniyor`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
    tokens = 1;
    lastTs = Date.now();
  }

  tokens -= 1;
  rateLimiters.set(platform, { tokens, lastTs });
  await fn();
}

// Platform bazlı rate limit konfigürasyonu (istek / dakika)
export const PLATFORM_RATE_LIMITS: Record<string, number> = {
  TRENDYOL: 60,
  HEPSIBURADA: 200,
  N11: 30,
  CICEKSEPETI: 60,
  AMAZON_TR: 60,
  PTTAVM: 30,
  PAZARAMA: 60,
  WOOCOMMERCE: 120,
  SHOPIFY: 40,
  IDEASOFT: 60,
  TSOFT: 60,
  TICIMAX: 60,
  DEFAULT: 30,
};
