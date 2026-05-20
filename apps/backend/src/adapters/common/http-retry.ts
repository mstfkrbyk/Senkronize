import { Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import {
  PLATFORM_RATE_LIMITS,
  getRateLimitConfig,
  platformRequestsPerMinute,
} from './rate-limit.config';
import { MaxRetriesExceededException } from './rate-limit.exceptions';

export { PLATFORM_RATE_LIMITS, getRateLimitConfig, platformRequestsPerMinute };

const logger = new Logger('HttpRetry');

export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
  retryOn?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryConfig {
  maxAttempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(header: string | null): number {
  if (!header) {
    return 60;
  }
  const parsed = parseInt(header, 10);
  return !Number.isNaN(parsed) && parsed >= 0 ? parsed : 60;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const response = await fetch(url, options);
    lastResponse = response;

    if (response.status === 429) {
      const retryAfter = parseRetryAfterSeconds(
        response.headers.get('Retry-After'),
      );
      logger.warn(
        `HTTP 429 → ${String(attempt + 1)}. deneme sonrası ${String(retryAfter)}s bekleniyor`,
      );
      if (attempt < config.maxAttempts - 1) {
        await sleep(retryAfter * 1000);
        continue;
      }
      return response;
    }

    if (response.status === 503 && attempt < config.maxAttempts - 1) {
      const waitMs = Math.pow(2, attempt) * 1000;
      logger.warn(
        `HTTP 503 → ${String(attempt + 1)}. deneme sonrası ${String(waitMs)}ms bekleniyor`,
      );
      await sleep(waitMs);
      continue;
    }

    if (
      response.status >= 500 &&
      response.status !== 503 &&
      attempt < config.maxAttempts - 1
    ) {
      const waitMs = Math.pow(2, attempt) * 1000;
      logger.warn(
        `HTTP ${String(response.status)} → ${String(attempt + 1)}. deneme sonrası ${String(waitMs)}ms bekleniyor`,
      );
      await sleep(waitMs);
      continue;
    }

    return response;
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw new MaxRetriesExceededException();
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

      if (status === 429 && retryAfterHeader !== undefined) {
        const raw = Array.isArray(retryAfterHeader)
          ? retryAfterHeader[0]
          : retryAfterHeader;
        waitMs = parseRetryAfterSeconds(String(raw)) * 1000;
      } else if (status === 503) {
        waitMs = Math.pow(2, attempt - 1) * 1000;
      }

      logger.warn(
        `HTTP ${String(status)} → ${String(attempt)}. deneme sonrası ${String(waitMs)}ms bekleniyor`,
      );
      options.onRetry?.(attempt, error);
      await sleep(waitMs);
    }
  }
  throw new MaxRetriesExceededException();
}

type RateLimiterState = { tokens: number; lastTs: number };

const rateLimiters = new Map<string, RateLimiterState>();

export async function withRateLimit<T = void>(
  platform: string,
  requestsPerMinute: number,
  fn: () => Promise<T>,
): Promise<T> {
  const rpm =
    requestsPerMinute > 0
      ? requestsPerMinute
      : platformRequestsPerMinute(platform);
  const now = Date.now();
  const prev = rateLimiters.get(platform) ?? {
    tokens: rpm,
    lastTs: now,
  };
  const elapsedMin = (now - prev.lastTs) / 60_000;
  let tokens = Math.min(rpm, prev.tokens + elapsedMin * rpm);
  let lastTs = now;

  if (tokens < 1) {
    const need = 1 - tokens;
    const waitMs = (need / rpm) * 60_000;
    logger.warn(
      `${platform} rate limit → ${String(Math.ceil(waitMs / 1000))}s bekleniyor`,
    );
    await sleep(waitMs);
    tokens = 1;
    lastTs = Date.now();
  }

  tokens -= 1;
  rateLimiters.set(platform, { tokens, lastTs });
  return await fn();
}
