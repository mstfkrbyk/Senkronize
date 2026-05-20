import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from '../../common/cache/cache.constants';
import { RateLimitMonitorService } from '../../monitoring/rate-limit-monitor.service';
import { getRateLimitConfig } from './rate-limit.config';
import { RateLimitExceededException } from './rate-limit.exceptions';

const TOKEN_BUCKET_TTL_SEC = 3600;

const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + elapsed * refill_rate)
last_refill = now

if tokens < requested then
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  redis.call('EXPIRE', key, tonumber(ARGV[5]))
  return {0, tokens}
end

tokens = tokens - requested
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, tonumber(ARGV[5]))
return {1, tokens}
`;

interface LocalBucket {
  tokens: number;
  lastRefillMs: number;
  capacity: number;
  refillPerMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class RedisRateLimiter {
  private readonly logger = new Logger(RedisRateLimiter.name);
  private readonly localBuckets = new Map<string, LocalBucket>();

  constructor(
    @Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null,
    @Optional() private readonly rateLimitMonitor?: RateLimitMonitorService,
  ) {}

  async acquire(platform: string, orgId: string): Promise<boolean> {
    return this.acquireBatch(platform, orgId, 1);
  }

  async acquireBatch(
    platform: string,
    orgId: string,
    count: number,
  ): Promise<boolean> {
    if (count < 1) {
      return true;
    }
    const { capacity, refillPerSecond } = this.bucketParams(platform);
    const key = this.bucketKey(platform, orgId);
    const nowSec = Date.now() / 1000;

    if (this.redis) {
      const result = await this.runTokenBucket(
        key,
        capacity,
        refillPerSecond,
        nowSec,
        count,
      );
      return result.allowed;
    }

    return this.localAcquire(key, capacity, refillPerSecond, count);
  }

  /** Eski adaptör uyumluluğu — limit aşılırsa exception fırlatır. */
  async acquireOrThrow(platform: string, orgId: string): Promise<void> {
    const ok = await this.acquire(platform, orgId);
    if (!ok) {
      const retryAfter = await this.retryAfterSeconds(platform, orgId);
      void this.rateLimitMonitor?.recordPlatformRateLimitViolation(
        platform,
        orgId,
        retryAfter,
      );
      throw new RateLimitExceededException(platform, retryAfter);
    }
  }

  async acquireWithRetry(
    platform: string,
    orgId: string,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const ok = await this.acquire(platform, orgId);
      if (ok) {
        return;
      }
      if (attempt >= maxRetries) {
        const retryAfter = await this.retryAfterSeconds(platform, orgId);
        void this.rateLimitMonitor?.recordPlatformRateLimitViolation(
          platform,
          orgId,
          retryAfter,
        );
        throw new RateLimitExceededException(platform, retryAfter);
      }
      const waitMs = (await this.retryAfterSeconds(platform, orgId)) * 1000;
      this.logger.warn(
        `${platform} rate limit — ${String(waitMs / 1000)}s bekleniyor (deneme ${String(attempt + 1)}/${String(maxRetries)})`,
      );
      await sleep(waitMs);
    }
  }

  async remaining(platform: string, orgId: string): Promise<number> {
    const { capacity, refillPerSecond } = this.bucketParams(platform);
    const key = this.bucketKey(platform, orgId);
    const nowSec = Date.now() / 1000;

    if (this.redis) {
      const state = await this.readBucketState(key, capacity, refillPerSecond, nowSec);
      return Math.max(0, Math.floor(state.tokens));
    }

    const bucket = this.refillLocalBucket(
      this.getOrCreateLocalBucket(key, capacity, refillPerSecond),
    );
    return Math.max(0, Math.floor(bucket.tokens));
  }

  async nextAvailableAt(platform: string, orgId: string): Promise<Date> {
    const { capacity, refillPerSecond } = this.bucketParams(platform);
    const key = this.bucketKey(platform, orgId);
    const nowMs = Date.now();
    const nowSec = nowMs / 1000;

    let tokens: number;
    if (this.redis) {
      const state = await this.readBucketState(key, capacity, refillPerSecond, nowSec);
      tokens = state.tokens;
    } else {
      const bucket = this.refillLocalBucket(
        this.getOrCreateLocalBucket(key, capacity, refillPerSecond),
      );
      tokens = bucket.tokens;
    }

    if (tokens >= 1) {
      return new Date(nowMs);
    }
    const deficit = 1 - tokens;
    const waitMs = Math.ceil((deficit / refillPerSecond) * 1000);
    return new Date(nowMs + waitMs);
  }

  private bucketKey(platform: string, orgId: string): string {
    return `ratelimit:tb:${platform.toUpperCase()}:${orgId}`;
  }

  private bucketParams(platform: string): {
    capacity: number;
    refillPerSecond: number;
  } {
    const config = getRateLimitConfig(platform);
    return {
      capacity: config.burstLimit,
      refillPerSecond: config.requestsPerMinute / 60,
    };
  }

  private async retryAfterSeconds(
    platform: string,
    orgId: string,
  ): Promise<number> {
    const next = await this.nextAvailableAt(platform, orgId);
    return Math.max(1, Math.ceil((next.getTime() - Date.now()) / 1000));
  }

  private async runTokenBucket(
    key: string,
    capacity: number,
    refillPerSecond: number,
    nowSec: number,
    requested: number,
  ): Promise<{ allowed: boolean; tokens: number }> {
    if (!this.redis) {
      return { allowed: false, tokens: 0 };
    }

    const raw = (await this.redis.eval(
      TOKEN_BUCKET_LUA,
      1,
      key,
      String(capacity),
      String(refillPerSecond),
      String(nowSec),
      String(requested),
      String(TOKEN_BUCKET_TTL_SEC),
    )) as [number, number];
    return { allowed: raw[0] === 1, tokens: raw[1] };
  }

  private async readBucketState(
    key: string,
    capacity: number,
    refillPerSecond: number,
    nowSec: number,
  ): Promise<{ tokens: number }> {
    if (!this.redis) {
      return { tokens: capacity };
    }
    const data = await this.redis.hmget(key, 'tokens', 'last_refill');
    let tokens = data[0] ? parseFloat(data[0]) : capacity;
    let lastRefill = data[1] ? parseFloat(data[1]) : nowSec;
    const elapsed = Math.max(0, nowSec - lastRefill);
    tokens = Math.min(capacity, tokens + elapsed * refillPerSecond);
    return { tokens };
  }

  private getOrCreateLocalBucket(
    key: string,
    capacity: number,
    refillPerSecond: number,
  ): LocalBucket {
    let bucket = this.localBuckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefillMs: Date.now(),
        capacity,
        refillPerMs: refillPerSecond / 1000,
      };
      this.localBuckets.set(key, bucket);
    }
    return bucket;
  }

  private refillLocalBucket(bucket: LocalBucket): LocalBucket {
    const now = Date.now();
    const elapsed = Math.max(0, now - bucket.lastRefillMs);
    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + elapsed * bucket.refillPerMs,
    );
    bucket.lastRefillMs = now;
    return bucket;
  }

  private localAcquire(
    key: string,
    capacity: number,
    refillPerSecond: number,
    count: number,
  ): boolean {
    const bucket = this.refillLocalBucket(
      this.getOrCreateLocalBucket(key, capacity, refillPerSecond),
    );
    if (bucket.tokens < count) {
      return false;
    }
    bucket.tokens -= count;
    return true;
  }
}
