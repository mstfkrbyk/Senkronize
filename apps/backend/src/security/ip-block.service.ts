import { BadRequestException, Injectable } from '@nestjs/common';

import { CacheService } from '../common/cache/cache.service';

const REDIS_BLOCKED_IPS = CacheService.key('security', 'blocked_ips');

@Injectable()
export class IpBlockService {
  private readonly memoryFallback = new Set<string>();

  constructor(private readonly cache: CacheService) {}

  normalizeClientIp(
    ip: string | undefined,
    forwarded: string | string[] | undefined,
  ): string | null {
    const raw =
      typeof ip === 'string' && ip.length > 0
        ? ip
        : typeof forwarded === 'string'
          ? forwarded.split(',')[0]?.trim()
          : Array.isArray(forwarded)
            ? forwarded[0]?.trim()
            : undefined;
    if (!raw) {
      return null;
    }
    return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  }

  async isBlocked(ip: string | null): Promise<boolean> {
    if (!ip) {
      return false;
    }
    if (this.memoryFallback.has(ip)) {
      return true;
    }
    const hit = await this.cache.sismember(REDIS_BLOCKED_IPS, ip);
    return hit === true;
  }

  async setBlocked(ipRaw: string, blocked: boolean): Promise<void> {
    const ip = this.normalizeClientIp(ipRaw, undefined);
    if (!ip) {
      throw new BadRequestException('Geçersiz IP adresi');
    }
    if (blocked) {
      this.memoryFallback.add(ip);
      await this.cache.sadd(REDIS_BLOCKED_IPS, ip);
    } else {
      this.memoryFallback.delete(ip);
      await this.cache.srem(REDIS_BLOCKED_IPS, ip);
    }
  }

  async listBlocked(): Promise<string[]> {
    const fromRedis = await this.cache.smembers(REDIS_BLOCKED_IPS);
    if (fromRedis && fromRedis.length > 0) {
      return [...new Set(fromRedis)].sort();
    }
    return [...this.memoryFallback].sort();
  }
}
