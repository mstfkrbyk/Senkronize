import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from '../../common/cache/cache.constants';
import { CircuitBreakerOpenException } from './rate-limit.exceptions';

const HEALTH_WINDOW_SEC = 3600;
const CIRCUIT_BREAKER_DURATION_SEC = 300;
const ERROR_RATE_THRESHOLD = 0.5;
const MIN_SAMPLES_FOR_CIRCUIT = 10;

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  private readonly localTotals = new Map<string, { ok: number; err: number; windowStart: number }>();
  private readonly localCircuitOpen = new Map<string, number>();
  private readonly localPlatformDown = new Set<string>();

  constructor(@Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null) {}

  async recordSuccess(platform: string, orgId: string): Promise<void> {
    await this.recordOutcome(platform, orgId, true);
  }

  async recordError(platform: string, orgId: string): Promise<void> {
    await this.recordOutcome(platform, orgId, false);
    const rate = await this.getErrorRate(platform, orgId);
    if (rate >= ERROR_RATE_THRESHOLD) {
      await this.openCircuit(platform, orgId);
    }
    await this.markPlatformUnavailable(platform);
  }

  async getErrorRate(platform: string, orgId: string): Promise<number> {
    const stats = await this.getStats(platform, orgId);
    if (stats.total === 0) {
      return 0;
    }
    return stats.errors / stats.total;
  }

  async isAvailable(platform: string): Promise<boolean> {
    const key = this.platformAvailableKey(platform);
    if (this.redis) {
      const flag = await this.redis.get(key);
      return flag !== '0';
    }
    return !this.localPlatformDown.has(platform.toUpperCase());
  }

  async checkCircuitBreaker(platform: string, orgId: string): Promise<void> {
    const openUntil = await this.getCircuitOpenUntil(platform, orgId);
    if (openUntil === null) {
      return;
    }
    const now = Date.now();
    if (openUntil > now) {
      const retryAfter = Math.max(1, Math.ceil((openUntil - now) / 1000));
      throw new CircuitBreakerOpenException(platform, retryAfter);
    }
    await this.clearCircuit(platform, orgId);
  }

  private async recordOutcome(
    platform: string,
    orgId: string,
    success: boolean,
  ): Promise<void> {
    const key = this.healthKey(platform, orgId);
    if (this.redis) {
      const field = success ? 'ok' : 'err';
      const pipe = this.redis.pipeline();
      pipe.hincrby(key, field, 1);
      pipe.expire(key, HEALTH_WINDOW_SEC);
      await pipe.exec();
      return;
    }

    const now = Date.now();
    let entry = this.localTotals.get(key);
    if (!entry || now - entry.windowStart > HEALTH_WINDOW_SEC * 1000) {
      entry = { ok: 0, err: 0, windowStart: now };
      this.localTotals.set(key, entry);
    }
    if (success) {
      entry.ok += 1;
    } else {
      entry.err += 1;
    }
  }

  private async getStats(
    platform: string,
    orgId: string,
  ): Promise<{ ok: number; errors: number; total: number }> {
    const key = this.healthKey(platform, orgId);
    if (this.redis) {
      const raw = await this.redis.hgetall(key);
      const ok = parseInt(raw.ok ?? '0', 10) || 0;
      const errors = parseInt(raw.err ?? '0', 10) || 0;
      return { ok, errors, total: ok + errors };
    }

    const entry = this.localTotals.get(key);
    if (!entry) {
      return { ok: 0, errors: 0, total: 0 };
    }
    return {
      ok: entry.ok,
      errors: entry.err,
      total: entry.ok + entry.err,
    };
  }

  private async openCircuit(platform: string, orgId: string): Promise<void> {
    const stats = await this.getStats(platform, orgId);
    if (stats.total < MIN_SAMPLES_FOR_CIRCUIT) {
      return;
    }
    const openUntil = Date.now() + CIRCUIT_BREAKER_DURATION_SEC * 1000;
    const key = this.circuitKey(platform, orgId);
    if (this.redis) {
      await this.redis.set(
        key,
        String(openUntil),
        'EX',
        CIRCUIT_BREAKER_DURATION_SEC,
      );
    } else {
      this.localCircuitOpen.set(key, openUntil);
    }
    this.logger.warn('Platform devre kesici açıldı', {
      platform,
      organizationId: orgId,
      errorRate: stats.errors / stats.total,
    });
  }

  private async getCircuitOpenUntil(
    platform: string,
    orgId: string,
  ): Promise<number | null> {
    const key = this.circuitKey(platform, orgId);
    if (this.redis) {
      const raw = await this.redis.get(key);
      if (!raw) {
        return null;
      }
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return this.localCircuitOpen.get(key) ?? null;
  }

  private async clearCircuit(platform: string, orgId: string): Promise<void> {
    const key = this.circuitKey(platform, orgId);
    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.localCircuitOpen.delete(key);
    }
  }

  private async markPlatformUnavailable(platform: string): Promise<void> {
    const key = this.platformAvailableKey(platform);
    if (this.redis) {
      await this.redis.set(key, '0', 'EX', CIRCUIT_BREAKER_DURATION_SEC);
    } else {
      this.localPlatformDown.add(platform.toUpperCase());
      setTimeout(() => {
        this.localPlatformDown.delete(platform.toUpperCase());
      }, CIRCUIT_BREAKER_DURATION_SEC * 1000).unref?.();
    }
  }

  private healthKey(platform: string, orgId: string): string {
    return `platform:health:${platform.toUpperCase()}:${orgId}`;
  }

  private circuitKey(platform: string, orgId: string): string {
    return `platform:circuit:${platform.toUpperCase()}:${orgId}`;
  }

  private platformAvailableKey(platform: string): string {
    return `platform:available:${platform.toUpperCase()}`;
  }
}
