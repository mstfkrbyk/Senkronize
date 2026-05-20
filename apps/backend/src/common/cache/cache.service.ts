import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from './cache.constants';
import { CacheKeys } from './cache-keys';
import { CACHE_TTL } from './cache-ttl';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number = CACHE_TTL.DASHBOARD;

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

  /** Ham Redis INCR + ilk çağrıda EXPIRE (güvenlik sayaçları için). */
  async incrWithExpire(key: string, expirySeconds: number): Promise<number | null> {
    if (!this.redis) {
      return null;
    }
    try {
      const n = await this.redis.incr(key);
      if (n === 1) {
        await this.redis.expire(key, expirySeconds);
      }
      return n;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis incr failed: ${message}`);
      return null;
    }
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!this.redis || members.length === 0) {
      return;
    }
    try {
      await this.redis.sadd(key, ...members);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis sadd failed: ${message}`);
    }
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (!this.redis || members.length === 0) {
      return;
    }
    try {
      await this.redis.srem(key, ...members);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis srem failed: ${message}`);
    }
  }

  async sismember(key: string, member: string): Promise<boolean | null> {
    if (!this.redis) {
      return null;
    }
    try {
      const r = await this.redis.sismember(key, member);
      return r === 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Redis sismember failed: ${message}`);
      return null;
    }
  }

  async smembers(key: string): Promise<string[] | null> {
    if (!this.redis) {
      return null;
    }
    try {
      return await this.redis.smembers(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Redis smembers failed: ${message}`);
      return null;
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

  /** Read-through: önbellekte varsa döner, yoksa üretir ve yazar. */
  async readThrough<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) {
      return hit;
    }
    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Organizasyona ait panel, rapor ve liste önbelleklerini temizler. */
  async invalidateOrg(organizationId: string): Promise<void> {
    await Promise.all([
      this.delPattern(`${CacheKeys.dashboard(organizationId)}*`),
      this.delPattern(`${CacheKeys.platformStats(organizationId)}*`),
      this.delPattern(`${CacheKeys.listing(organizationId)}*`),
      this.delPattern(`${CacheKeys.product(organizationId, '*')}`),
      this.del(CacheKeys.subscription(organizationId)),
      this.delPattern(CacheService.key('reports', '*', organizationId, '*')),
      this.delPattern(CacheService.key('reports', organizationId, '*')),
      this.delPattern(CacheService.key('dashboard', organizationId, '*')),
      this.delPattern(CacheService.key('analytics', '*', organizationId, '*')),
      this.delPattern(CacheService.key('products', organizationId, '*')),
      this.delPattern(CacheService.key('listings', organizationId, '*')),
    ]);
  }

  /** Tek listeleme buybox / fiyat önbelleğini temizler. */
  async invalidateListing(listingId: string): Promise<void> {
    await this.del(CacheKeys.buyboxScore(listingId));
  }

  /** Dashboard KPI + platform performans önbelleği (sipariş sync vb.) */
  async invalidateDashboardForOrg(organizationId: string): Promise<void> {
    await Promise.all([
      this.delPattern(`${CacheKeys.dashboard(organizationId)}*`),
      this.delPattern(`${CacheKeys.dashboardKpis(organizationId, '*')}`),
      this.delPattern(`${CacheKeys.platformPerformance(organizationId, '*')}`),
      this.delPattern(CacheService.key('dashboard', organizationId, '*')),
    ]);
  }

  /** Rapor + panel özet önbelleğini temizle (sipariş senkronu vb.) */
  async invalidateReportsForOrg(organizationId: string): Promise<void> {
    await Promise.all([
      this.invalidateDashboardForOrg(organizationId),
      this.delPattern(CacheService.key('reports', '*', organizationId, '*')),
      this.delPattern(CacheService.key('reports', organizationId, '*')),
    ]);
  }

  /** Ürün listesi önbelleğini temizle */
  async invalidateProductsForOrg(organizationId: string): Promise<void> {
    await Promise.all([
      this.delPattern(CacheService.key('products', organizationId, '*')),
      this.delPattern(`${CacheKeys.productsList(organizationId, '*')}`),
    ]);
  }

  /** Stok özeti önbelleğini temizle */
  async invalidateStockForOrg(organizationId: string): Promise<void> {
    await this.del(CacheKeys.stockSummary(organizationId));
  }

  /** Listeleme listesi önbelleğini temizle */
  async invalidateListingsForOrg(organizationId: string): Promise<void> {
    await this.delPattern(CacheService.key('listings', organizationId, '*'));
  }

  static key(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}
