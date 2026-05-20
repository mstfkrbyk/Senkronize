import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from '../../common/cache/cache.constants';
import { getRateLimitConfig } from './rate-limit.config';
import { RateLimitExceededException } from './rate-limit.exceptions';

const MINUTE_WINDOW_SEC = 60;
const HOUR_WINDOW_SEC = 3600;
const DAY_WINDOW_SEC = 86_400;
const BURST_WINDOW_SEC = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class RedisRateLimiter {
  private readonly logger = new Logger(RedisRateLimiter.name);

  /** Redis yokken process içi sliding window (tek instance). */
  private readonly localCounters = new Map<string, { count: number; expiresAt: number }>();

  constructor(@Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null) {}

  async acquire(platform: string, orgId: string): Promise<void> {
    const config = getRateLimitConfig(platform);
    const baseKey = `ratelimit:${platform.toUpperCase()}:${orgId}`;

    await this.checkWindow(
      `${baseKey}:min`,
      MINUTE_WINDOW_SEC,
      config.requestsPerMinute,
      platform,
      config.retryAfterSeconds,
    );

    if (config.requestsPerHour !== undefined) {
      await this.checkWindow(
        `${baseKey}:hour`,
        HOUR_WINDOW_SEC,
        config.requestsPerHour,
        platform,
        config.retryAfterSeconds,
      );
    }

    if (config.requestsPerDay !== undefined) {
      await this.checkWindow(
        `${baseKey}:day`,
        DAY_WINDOW_SEC,
        config.requestsPerDay,
        platform,
        config.retryAfterSeconds,
      );
    }

    if (config.burstLimit !== undefined) {
      await this.checkWindow(
        `${baseKey}:burst`,
        BURST_WINDOW_SEC,
        config.burstLimit,
        platform,
        config.retryAfterSeconds,
      );
    }
  }

  async acquireWithRetry(
    platform: string,
    orgId: string,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.acquire(platform, orgId);
        return;
      } catch (error) {
        if (
          !(error instanceof RateLimitExceededException) ||
          attempt >= maxRetries
        ) {
          throw error;
        }
        const waitMs = error.retryAfterSeconds * 1000;
        this.logger.warn(
          `${platform} rate limit — ${String(error.retryAfterSeconds)}s bekleniyor (deneme ${String(attempt + 1)}/${String(maxRetries)})`,
        );
        await sleep(waitMs);
      }
    }
  }

  private async checkWindow(
    key: string,
    windowSeconds: number,
    maxRequests: number,
    platform: string,
    fallbackRetrySeconds: number,
  ): Promise<void> {
    if (this.redis) {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }
      if (count > maxRequests) {
        const ttl = await this.redis.ttl(key);
        const retryAfter =
          ttl > 0 ? ttl : fallbackRetrySeconds;
        throw new RateLimitExceededException(platform, retryAfter);
      }
      return;
    }

    const now = Date.now();
    const entry = this.localCounters.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.localCounters.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return;
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      const retryAfter = Math.max(
        1,
        Math.ceil((entry.expiresAt - now) / 1000),
      );
      throw new RateLimitExceededException(platform, retryAfter);
    }
  }
}
