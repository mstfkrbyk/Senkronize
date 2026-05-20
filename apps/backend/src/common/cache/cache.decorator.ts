import type { CacheService } from './cache.service';

/** `Cacheable` dekoratörünün beklediği `this` şekli — serviste `cache: CacheService` olmalı. */
export type CacheableHost = { cache: CacheService };

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
  return cache.readThrough(key, ttlSeconds, producer);
}

/**
 * Sınıf metoduna read-through cache uygular.
 * Sınıfın `cache: CacheService` alanı olmalı (constructor ile inject).
 */
export function Cacheable<A extends unknown[]>(
  keyFn: (this: CacheableHost, ...args: A) => string,
  ttlSeconds = 300,
): (
  _target: object,
  _propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<(...args: A) => Promise<unknown>>,
) => void {
  return (_target, _propertyKey, descriptor): void => {
    const original = descriptor.value;
    if (!original) {
      return;
    }
    descriptor.value = async function (
      this: CacheableHost,
      ...args: A
    ): Promise<unknown> {
      const key = keyFn.call(this, ...args);
      return readThroughCache(this.cache, key, ttlSeconds, () =>
        original.apply(this, args) as Promise<unknown>,
      );
    };
  };
}

export async function evictCachePatterns(
  cache: CacheService,
  patterns: string[],
): Promise<void> {
  await Promise.all(patterns.map((p) => cache.delPattern(p)));
}
