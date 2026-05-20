import { BadRequestException, Injectable } from '@nestjs/common';

import { CacheService } from '../common/cache/cache.service';

const REDIS_BLOCKED_IPS = CacheService.key('security', 'blocked_ips');
const IP_REQUEST_WINDOW_SEC = 300;
const IP_REQUEST_THRESHOLD = 100;
const IP_TEMP_BLOCK_SEC = 900;
const IP_TEMP_BLOCK_MAX = 3;

@Injectable()
export class IpBlockService {
  private readonly memoryFallback = new Set<string>();
  private readonly memoryTempBlocked = new Map<string, number>();
  private readonly memoryRequestCounts = new Map<
    string,
    { count: number; expiresAt: number }
  >();

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
    const permanent = await this.cache.sismember(REDIS_BLOCKED_IPS, ip);
    if (permanent === true) {
      return true;
    }
    return this.isTempBlocked(ip);
  }

  async recordRequest(ip: string | null): Promise<'ok' | 'temp_blocked' | 'permanent_blocked'> {
    if (!ip) {
      return 'ok';
    }
    if (await this.isBlocked(ip)) {
      return this.memoryFallback.has(ip) ||
        (await this.cache.sismember(REDIS_BLOCKED_IPS, ip)) === true
        ? 'permanent_blocked'
        : 'temp_blocked';
    }

    const count = await this.incrementRequestCount(ip);
    if (count <= IP_REQUEST_THRESHOLD) {
      return 'ok';
    }

    const blockCount = await this.incrementTempBlockCount(ip);
    if (blockCount >= IP_TEMP_BLOCK_MAX) {
      await this.setBlocked(ip, true);
      return 'permanent_blocked';
    }

    await this.setTempBlocked(ip);
    return 'temp_blocked';
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
      this.memoryTempBlocked.delete(ip);
      await this.cache.srem(REDIS_BLOCKED_IPS, ip);
      await this.cache.del(this.tempBlockKey(ip));
      await this.cache.del(this.tempBlockCountKey(ip));
    }
  }

  async unblock(ipRaw: string): Promise<void> {
    await this.setBlocked(ipRaw, false);
  }

  async listBlocked(): Promise<string[]> {
    const fromRedis = await this.cache.smembers(REDIS_BLOCKED_IPS);
    const merged = new Set<string>([
      ...this.memoryFallback,
      ...(fromRedis ?? []),
    ]);
    return [...merged].sort();
  }

  private async incrementRequestCount(ip: string): Promise<number> {
    const key = CacheService.key('security', 'ip_req', ip);
    const n = await this.cache.incrWithExpire(key, IP_REQUEST_WINDOW_SEC);
    if (n !== null) {
      return n;
    }

    const now = Date.now();
    const entry = this.memoryRequestCounts.get(ip);
    if (!entry || entry.expiresAt <= now) {
      this.memoryRequestCounts.set(ip, {
        count: 1,
        expiresAt: now + IP_REQUEST_WINDOW_SEC * 1000,
      });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  private async incrementTempBlockCount(ip: string): Promise<number> {
    const key = this.tempBlockCountKey(ip);
    const n = await this.cache.incrWithExpire(key, 86_400);
    if (n !== null) {
      return n;
    }
    return 1;
  }

  private async setTempBlocked(ip: string): Promise<void> {
    const until = Date.now() + IP_TEMP_BLOCK_SEC * 1000;
    this.memoryTempBlocked.set(ip, until);
    await this.cache.set(this.tempBlockKey(ip), { until }, IP_TEMP_BLOCK_SEC);
  }

  private async isTempBlocked(ip: string): Promise<boolean> {
    const memUntil = this.memoryTempBlocked.get(ip);
    if (memUntil !== undefined) {
      if (memUntil > Date.now()) {
        return true;
      }
      this.memoryTempBlocked.delete(ip);
      return false;
    }

    const raw = await this.cache.get<{ until: number }>(this.tempBlockKey(ip));
    if (!raw?.until) {
      return false;
    }
    return raw.until > Date.now();
  }

  private tempBlockKey(ip: string): string {
    return CacheService.key('security', 'ip_temp_block', ip);
  }

  private tempBlockCountKey(ip: string): string {
    return CacheService.key('security', 'ip_temp_block_count', ip);
  }
}
