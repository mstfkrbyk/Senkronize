import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from '../../common/cache/cache.constants';
import {
  CIRCUIT_BREAKER_CONFIG,
  type CircuitBreakerState,
} from './circuit-breaker.config';
import { PLATFORM_RATE_LIMIT_BUCKETS } from './rate-limit.config';
import { CircuitBreakerOpenException } from './rate-limit.exceptions';

export interface PlatformCircuitHealth {
  platform: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  errorCountInWindow: number;
  openedAt: string | null;
  nextProbeAt: string | null;
}

interface CircuitRecord {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  errorTimestamps: number[];
  openedAt: number | null;
}

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);
  private readonly localCircuits = new Map<string, CircuitRecord>();

  constructor(@Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null) {}

  async recordSuccess(platform: string, orgId: string): Promise<void> {
    void orgId;
    await this.onSuccess(platform);
  }

  async recordError(platform: string, orgId: string): Promise<void> {
    void orgId;
    await this.onFailure(platform);
  }

  async getErrorRate(platform: string, orgId: string): Promise<number> {
    void orgId;
    const record = await this.getRecord(platform);
    this.pruneErrors(record);
    const errors = record.errorTimestamps.length;
    if (errors === 0) {
      return 0;
    }
    return Math.min(1, errors / CIRCUIT_BREAKER_CONFIG.failureThreshold);
  }

  async isAvailable(platform: string): Promise<boolean> {
    const record = await this.getRecord(platform);
    await this.transitionIfNeeded(platform, record);
    return record.state !== 'OPEN';
  }

  async checkCircuitBreaker(platform: string, orgId: string): Promise<void> {
    void orgId;
    const record = await this.getRecord(platform);
    await this.transitionIfNeeded(platform, record);
    if (record.state === 'OPEN') {
      const retryAfter = this.openRetrySeconds(record);
      throw new CircuitBreakerOpenException(platform, retryAfter);
    }
  }

  async getAllPlatformHealth(): Promise<PlatformCircuitHealth[]> {
    const platforms = Object.keys(PLATFORM_RATE_LIMIT_BUCKETS);
    const results: PlatformCircuitHealth[] = [];
    for (const platform of platforms) {
      results.push(await this.getPlatformHealth(platform));
    }
    return results;
  }

  async getPlatformHealth(platform: string): Promise<PlatformCircuitHealth> {
    const key = platform.toUpperCase();
    const record = await this.getRecord(key);
    await this.transitionIfNeeded(key, record);
    this.pruneErrors(record);

    const openedAt =
      record.openedAt !== null ? new Date(record.openedAt).toISOString() : null;
    const nextProbeAt =
      record.state === 'OPEN' && record.openedAt !== null
        ? new Date(
            record.openedAt + CIRCUIT_BREAKER_CONFIG.timeout,
          ).toISOString()
        : null;

    return {
      platform: key,
      state: record.state,
      consecutiveFailures: record.consecutiveFailures,
      halfOpenSuccesses: record.halfOpenSuccesses,
      errorCountInWindow: record.errorTimestamps.length,
      openedAt,
      nextProbeAt,
    };
  }

  async resetCircuit(platform: string): Promise<void> {
    const key = platform.toUpperCase();
    const fresh: CircuitRecord = this.freshRecord();
    if (this.redis) {
      await this.redis.del(this.circuitKey(key));
    } else {
      this.localCircuits.set(key, fresh);
    }
    this.logger.warn('Platform devre kesici manuel sıfırlandı', { platform: key });
  }

  private async onSuccess(platform: string): Promise<void> {
    const key = platform.toUpperCase();
    const record = await this.getRecord(key);
    await this.transitionIfNeeded(key, record);

    if (record.state === 'HALF_OPEN') {
      record.halfOpenSuccesses += 1;
      if (record.halfOpenSuccesses >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
        Object.assign(record, this.freshRecord());
        this.logger.log('Platform devre kesici kapatıldı (HALF_OPEN → CLOSED)', {
          platform: key,
        });
      }
    } else if (record.state === 'CLOSED') {
      record.consecutiveFailures = 0;
    }

    await this.saveRecord(key, record);
  }

  private async onFailure(platform: string): Promise<void> {
    const key = platform.toUpperCase();
    const record = await this.getRecord(key);
    await this.transitionIfNeeded(key, record);

    const now = Date.now();
    record.errorTimestamps.push(now);
    this.pruneErrors(record);
    record.consecutiveFailures += 1;

    if (record.state === 'HALF_OPEN') {
      record.state = 'OPEN';
      record.openedAt = now;
      record.halfOpenSuccesses = 0;
      this.logger.warn('Platform devre kesici tekrar açıldı (HALF_OPEN → OPEN)', {
        platform: key,
      });
      await this.saveRecord(key, record);
      return;
    }

    if (
      record.state === 'CLOSED' &&
      record.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold
    ) {
      record.state = 'OPEN';
      record.openedAt = now;
      record.halfOpenSuccesses = 0;
      this.logger.warn('Platform devre kesici açıldı (CLOSED → OPEN)', {
        platform: key,
        consecutiveFailures: record.consecutiveFailures,
      });
    }

    await this.saveRecord(key, record);
  }

  private async transitionIfNeeded(
    platform: string,
    record: CircuitRecord,
  ): Promise<void> {
    if (record.state !== 'OPEN' || record.openedAt === null) {
      return;
    }
    const elapsed = Date.now() - record.openedAt;
    if (elapsed >= CIRCUIT_BREAKER_CONFIG.timeout) {
      record.state = 'HALF_OPEN';
      record.halfOpenSuccesses = 0;
      record.consecutiveFailures = 0;
      this.logger.log('Platform devre kesici test moduna geçti (OPEN → HALF_OPEN)', {
        platform,
      });
      await this.saveRecord(platform, record);
    }
  }

  private pruneErrors(record: CircuitRecord): void {
    const cutoff = Date.now() - CIRCUIT_BREAKER_CONFIG.monitoringWindow;
    record.errorTimestamps = record.errorTimestamps.filter((t) => t >= cutoff);
  }

  private openRetrySeconds(record: CircuitRecord): number {
    if (record.openedAt === null) {
      return Math.ceil(CIRCUIT_BREAKER_CONFIG.timeout / 1000);
    }
    const remaining =
      CIRCUIT_BREAKER_CONFIG.timeout - (Date.now() - record.openedAt);
    return Math.max(1, Math.ceil(remaining / 1000));
  }

  private freshRecord(): CircuitRecord {
    return {
      state: 'CLOSED',
      consecutiveFailures: 0,
      halfOpenSuccesses: 0,
      errorTimestamps: [],
      openedAt: null,
    };
  }

  private circuitKey(platform: string): string {
    return `platform:circuit:v2:${platform}`;
  }

  private async getRecord(platform: string): Promise<CircuitRecord> {
    const key = platform.toUpperCase();
    if (this.redis) {
      const raw = await this.redis.get(this.circuitKey(key));
      if (!raw) {
        return this.freshRecord();
      }
      try {
        const parsed = JSON.parse(raw) as CircuitRecord;
        return {
          state: parsed.state ?? 'CLOSED',
          consecutiveFailures: parsed.consecutiveFailures ?? 0,
          halfOpenSuccesses: parsed.halfOpenSuccesses ?? 0,
          errorTimestamps: Array.isArray(parsed.errorTimestamps)
            ? parsed.errorTimestamps
            : [],
          openedAt: parsed.openedAt ?? null,
        };
      } catch {
        return this.freshRecord();
      }
    }
    return this.localCircuits.get(key) ?? this.freshRecord();
  }

  private async saveRecord(
    platform: string,
    record: CircuitRecord,
  ): Promise<void> {
    const key = platform.toUpperCase();
    if (this.redis) {
      await this.redis.set(
        this.circuitKey(key),
        JSON.stringify(record),
        'EX',
        Math.ceil(CIRCUIT_BREAKER_CONFIG.monitoringWindow / 1000) + 600,
      );
      return;
    }
    this.localCircuits.set(key, record);
  }
}
