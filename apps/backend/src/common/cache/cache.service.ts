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

  /**
   * SCAN ile anahtar silme (KEYS yerine; üretim yükü için daha güvenli).
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          256,
        );
        cursor = next;
        if (keys.length > 0) {
          const batchSize = 500;
          for (let i = 0; i < keys.length; i += batchSize) {
            const slice = keys.slice(i, i + batchSize);
            await this.redis.unlink(...slice);
          }
        }
      } while (String(cursor) !== '0');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache delPattern failed: ${message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    await this.delPattern(pattern);
  }

  /** Rapor + panel özet önbelleğini temizle (sipariş senkronu vb.) */
  async invalidateReportsForOrg(organizationId: string): Promise<void> {
    await Promise.all([
      this.delPattern(CacheService.key('reports', '*', organizationId, '*')),
      this.delPattern(CacheService.key('reports', organizationId, '*')),
      this.delPattern(CacheService.key('dashboard', organizationId, '*')),
    ]);
  }

  /** Ürün listesi önbelleğini temizle */
  async invalidateProductsForOrg(organizationId: string): Promise<void> {
    await this.delPattern(CacheService.key('products', organizationId, '*'));
  }

  /** Listeleme listesi önbelleğini temizle */
  async invalidateListingsForOrg(organizationId: string): Promise<void> {
    await this.delPattern(CacheService.key('listings', organizationId, '*'));
  }

  static key(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}
