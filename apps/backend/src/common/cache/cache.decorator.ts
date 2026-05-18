import type { CacheService } from './cache.service';

/**
 * Nest DI ile servis metodlarında önbellek için yardımcı.
 * Method dekoratörü + ModuleRef kalıbı yerine `CacheService` inject edip bunu kullanın.
 */
export async function readThroughCache<T>(
  cache: CacheService,
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== null) {
    return hit;
  }
  const value = await producer();
  await cache.set(key, value, ttlSeconds);
  return value;
}

export async function evictCachePatterns(
  cache: CacheService,
  patterns: string[],
): Promise<void> {
  await Promise.all(patterns.map((p) => cache.delPattern(p)));
}
