import { Injectable, Logger } from '@nestjs/common';
import { AnomalySeverity, AnomalyType, Prisma } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PlatformDailyRequestPoint {
  platform: string;
  date: string;
  requestCount: number;
}

export interface RateLimitStatsResponse {
  violationsToday: number;
  platformDailyRequests: PlatformDailyRequestPoint[];
  topViolatingPlatforms: Array<{ platform: string; count: number }>;
}

const VIOLATION_FLAG_TTL_SEC = 3600;

@Injectable()
export class RateLimitMonitorService {
  private readonly logger = new Logger(RateLimitMonitorService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async recordPlatformRequest(platform: string, orgId: string): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const platformKey = platform.toUpperCase();
    const totalKey = CacheService.key(
      'metrics',
      'platform_req',
      dateKey,
      platformKey,
    );
    const orgKey = CacheService.key(
      'metrics',
      'platform_req_org',
      dateKey,
      platformKey,
      orgId,
    );
    await this.incrMetric(totalKey, 86_400);
    await this.incrMetric(orgKey, 86_400);
  }

  async recordPlatformRateLimitViolation(
    platform: string,
    organizationId: string,
    retryAfterSeconds: number,
  ): Promise<void> {
    await this.recordViolation('platform', platform, organizationId, {
      retryAfterSeconds,
    });
  }

  async recordApiDailyLimitViolation(
    organizationId: string,
    plan: string,
    limit: number,
  ): Promise<void> {
    await this.recordViolation('api_daily', plan, organizationId, { limit });
  }

  async recordIpRateLimitViolation(ip: string): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = CacheService.key(
      'metrics',
      'rate_violation_logged_ip',
      dateKey,
      ip,
    );
    const already = await this.cache.get<{ v: true }>(dedupeKey);
    if (already) {
      return;
    }
    await this.cache.set(dedupeKey, { v: true }, VIOLATION_FLAG_TTL_SEC);
    await this.recordViolation('ip', 'blocked', null, { ip });
  }

  async getStats(): Promise<RateLimitStatsResponse> {
    const today = new Date().toISOString().slice(0, 10);
    const violationsToday = await this.countViolationsForDate(today);
    const platformDailyRequests = await this.getPlatformDailySeries(today);
    const topViolatingPlatforms = await this.getTopViolatingPlatforms(today);

    return {
      violationsToday,
      platformDailyRequests,
      topViolatingPlatforms,
    };
  }

  private async recordViolation(
    source: string,
    platform: string,
    organizationId: string | null,
    details: Record<string, unknown>,
  ): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const counterKey = CacheService.key(
      'metrics',
      'rate_violation',
      dateKey,
      source,
      platform.toUpperCase(),
    );
    await this.incrMetric(counterKey, 86_400 * 7);

    if (organizationId) {
      const dedupeKey = CacheService.key(
        'metrics',
        'rate_violation_logged',
        dateKey,
        organizationId,
        source,
        platform.toUpperCase(),
      );
      const already = await this.cache.get<{ v: true }>(dedupeKey);
      if (already) {
        return;
      }
      await this.cache.set(dedupeKey, { v: true }, VIOLATION_FLAG_TTL_SEC);

      await this.logAnomaly(organizationId, {
        source,
        platform: platform.toUpperCase(),
        ...details,
      });
    }

    if (source !== 'ip') {
      this.logger.warn('Rate limit ihlali kaydedildi', {
        source,
        platform: platform.toUpperCase(),
        organizationId,
      });
    }
  }

  private async logAnomaly(
    organizationId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.anomalyLog.create({
        data: {
          organizationId,
          type: AnomalyType.API_RATE_SPIKE,
          severity: AnomalySeverity.MEDIUM,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AnomalyLog yazılamadı: ${message}`);
    }
  }

  private async incrMetric(key: string, ttlSec: number): Promise<void> {
    const n = await this.cache.incrWithExpire(key, ttlSec);
    if (n === null) {
      const current = (await this.cache.get<{ count: number }>(key))?.count ?? 0;
      await this.cache.set(key, { count: current + 1 }, ttlSec);
    }
  }

  private async countViolationsForDate(dateKey: string): Promise<number> {
    const pattern = CacheService.key('metrics', 'rate_violation', dateKey);
    void pattern;
    const platforms = await this.getTopViolatingPlatforms(dateKey);
    return platforms.reduce((sum, row) => sum + row.count, 0);
  }

  private async getTopViolatingPlatforms(
    dateKey: string,
  ): Promise<Array<{ platform: string; count: number }>> {
    const known = ['TRENDYOL', 'HEPSIBURADA', 'N11', 'AMAZON', 'DEFAULT'];
    const rows: Array<{ platform: string; count: number }> = [];
    for (const platform of known) {
      for (const source of ['platform', 'api_daily', 'ip']) {
        const key = CacheService.key(
          'metrics',
          'rate_violation',
          dateKey,
          source,
          platform,
        );
        const raw = await this.cache.get<{ count: number }>(key);
        const count = raw?.count ?? 0;
        if (count > 0) {
          rows.push({ platform: `${platform}:${source}`, count });
        }
      }
    }
    return rows.sort((a, b) => b.count - a.count).slice(0, 20);
  }

  private async getPlatformDailySeries(
    dateKey: string,
  ): Promise<PlatformDailyRequestPoint[]> {
    const platforms = [
      'TRENDYOL',
      'HEPSIBURADA',
      'N11',
      'AMAZON',
      'SHOPIFY',
      'DEFAULT',
    ];
    const points: PlatformDailyRequestPoint[] = [];
    for (const platform of platforms) {
      const key = CacheService.key('metrics', 'platform_req', dateKey, platform);
      const raw = await this.cache.get<{ count: number }>(key);
      points.push({
        platform,
        date: dateKey,
        requestCount: raw?.count ?? 0,
      });
    }
    return points;
  }
}
