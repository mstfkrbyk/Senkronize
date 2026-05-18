import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from './cache.constants';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl = 300; // 5 dakika

  constructor(
    @Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null,
  ) {}

  onModuleDestroy(): void {
    if (this.redis) {
      void this.redis.quit().catch(() => undefined);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) {
      return null;
    }
    try {
      const val = await this.redis.get(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Cache get miss: ${message}`);
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds = this.defaultTtl,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache set failed: ${message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.del(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Cache del failed: ${message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache delByPattern failed: ${message}`);
    }
  }

  /** Rapor önbelleğini temizle (sipariş senkronu vb.) */
  async invalidateReportsForOrg(organizationId: string): Promise<void> {
    await this.delByPattern(CacheService.key('reports', organizationId, '*'));
  }

  /** Ürün listesi önbelleğini temizle */
  async invalidateProductsForOrg(organizationId: string): Promise<void> {
    await this.delByPattern(CacheService.key('products', organizationId, '*'));
  }

  static key(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}
