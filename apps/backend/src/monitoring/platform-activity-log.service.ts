import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CACHE } from '../common/cache/cache.constants';
import { CacheService } from '../common/cache/cache.service';

export type PlatformActivityLevel = 'INFO' | 'WARN' | 'ERROR';

export interface PlatformActivityEntry {
  id: string;
  at: string;
  platform: string;
  organizationId: string | null;
  level: PlatformActivityLevel;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const MAX_ENTRIES = 500;
const LIST_TTL_SEC = 7 * 24 * 60 * 60;

@Injectable()
export class PlatformActivityLogService {
  private readonly logger = new Logger(PlatformActivityLogService.name);
  private readonly memory = new Map<string, PlatformActivityEntry[]>();

  constructor(
    private readonly cache: CacheService,
    @Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null,
  ) {}

  async append(entry: Omit<PlatformActivityEntry, 'id' | 'at'> & { at?: string }): Promise<void> {
    const full: PlatformActivityEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: entry.at ?? new Date().toISOString(),
      platform: entry.platform.toUpperCase(),
    };
    const key = this.listKey(full.platform);

    if (this.redis) {
      try {
        await this.redis.lpush(key, JSON.stringify(full));
        await this.redis.ltrim(key, 0, MAX_ENTRIES - 1);
        await this.redis.expire(key, LIST_TTL_SEC);
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Platform activity Redis yazılamadı: ${message}`);
      }
    }

    const bucket = this.memory.get(full.platform) ?? [];
    bucket.unshift(full);
    this.memory.set(full.platform, bucket.slice(0, MAX_ENTRIES));
  }

  async list(platform: string, limit = 100): Promise<PlatformActivityEntry[]> {
    const platformKey = platform.toUpperCase();
    const key = this.listKey(platformKey);
    const capped = Math.min(Math.max(limit, 1), MAX_ENTRIES);

    if (this.redis) {
      try {
        const raw = await this.redis.lrange(key, 0, capped - 1);
        return raw
          .map((line) => {
            try {
              return JSON.parse(line) as PlatformActivityEntry;
            } catch {
              return null;
            }
          })
          .filter((row): row is PlatformActivityEntry => row !== null);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Platform activity Redis okunamadı: ${message}`);
      }
    }

    return (this.memory.get(platformKey) ?? []).slice(0, capped);
  }

  private listKey(platform: string): string {
    return CacheService.key('platform', 'activity', platform);
  }
}
