import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { CACHE_TTL } from '../../common/cache/cache-ttl';

interface MemoryEntry {
  token: string;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();

/** Redis + bellek önbellek anahtarı (credential hash). */
export function marketplaceTokenCacheKey(
  platform: string,
  credentialSeed: string,
): string {
  const digest = createHash('sha256')
    .update(`${platform}:${credentialSeed}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `mp:token:${platform.toLowerCase()}:${digest}`;
}

@Injectable()
export class MarketplaceTokenCache {
  constructor(private readonly cache: CacheService) {}

  async get(key: string): Promise<string | null> {
    const mem = memoryCache.get(key);
    if (mem !== undefined && mem.expiresAt > Date.now() + 5_000) {
      return mem.token;
    }
    const hit = await this.cache.get<string>(key);
    if (typeof hit === 'string' && hit.length > 0) {
      memoryCache.set(key, {
        token: hit,
        expiresAt: Date.now() + CACHE_TTL.MARKETPLACE_ACCESS_TOKEN * 1000,
      });
      return hit;
    }
    return null;
  }

  async set(
    key: string,
    token: string,
    ttlSeconds: number = CACHE_TTL.MARKETPLACE_ACCESS_TOKEN,
  ): Promise<void> {
    memoryCache.set(key, {
      token,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    await this.cache.set(key, token, ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    memoryCache.delete(key);
    await this.cache.del(key);
  }
}
