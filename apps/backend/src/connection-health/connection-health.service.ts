import { Injectable, NotFoundException } from '@nestjs/common';
import { Marketplace, SyncLogStatus } from '@prisma/client';

import { getRateLimitConfig } from '../adapters/common/rate-limit.config';
import { PlatformHealthService } from '../adapters/common/platform-health.service';
import { RedisRateLimiter } from '../adapters/common/redis-rate-limiter';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  ConnectionHealthResponse,
  ConnectionHealthStatus,
} from './connection-health.types';

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const STALE_SYNC_MS = 2 * 60 * 60 * 1000;

interface SyncWindowStats {
  successRuns: number;
  failedRuns: number;
  totalRuns: number;
  successRate: number;
  avgResponseTimeMs: number | null;
}

@Injectable()
export class ConnectionHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformHealth: PlatformHealthService,
    private readonly rateLimiter: RedisRateLimiter,
  ) {}

  async getMarketplaceHealth(
    organizationId: string,
    connectionId: string,
  ): Promise<ConnectionHealthResponse> {
    const conn = await this.prisma.marketplaceConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!conn) {
      throw new NotFoundException('Bağlantı bulunamadı');
    }
    const platformKey = conn.platform;
    const window = await this.getSyncWindowStats(
      organizationId,
      platformKey,
      undefined,
    );
    return this.buildHealthResponse({
      organizationId,
      platformKey,
      isActive: conn.isActive,
      lastSyncAt: conn.lastSyncAt,
      lastErrorAt: conn.lastErrorAt,
      lastErrorMessage: conn.lastErrorMessage,
      syncErrorCount: conn.syncErrorCount,
      window,
    });
  }

  async getErpHealth(
    organizationId: string,
    connectionId: string,
  ): Promise<ConnectionHealthResponse> {
    const conn = await this.prisma.erpConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!conn) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    const platformKey = conn.erpType;
    const newJobPrefix = `erp:${conn.erpType}:${connectionId}:`;
    const legacyJobPrefix = `erp:${connectionId}:`;
    const window = await this.getSyncWindowStats(
      organizationId,
      ErpSyncSettingsService.erpSyncLogPlatform(),
      [newJobPrefix, legacyJobPrefix],
    );
    return this.buildHealthResponse({
      organizationId,
      platformKey,
      isActive: conn.isActive,
      lastSyncAt: conn.lastSyncAt,
      lastErrorAt: conn.lastErrorAt,
      lastErrorMessage: conn.lastErrorMessage,
      syncErrorCount: conn.syncErrorCount,
      window,
    });
  }

  private async getSyncWindowStats(
    organizationId: string,
    platform: Marketplace,
    jobTypePrefixes: string | string[] | undefined,
  ): Promise<SyncWindowStats> {
    const since = new Date(Date.now() - HOURS_24_MS);
    const prefixes = jobTypePrefixes
      ? Array.isArray(jobTypePrefixes)
        ? jobTypePrefixes
        : [jobTypePrefixes]
      : [];
    const logs = await this.prisma.syncLog.findMany({
      where: {
        organizationId,
        platform,
        startedAt: { gte: since },
        status: { not: SyncLogStatus.RUNNING },
        ...(prefixes.length > 0
          ? {
              OR: prefixes.map((prefix) => ({
                jobType: { startsWith: prefix },
              })),
            }
          : {}),
      },
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    let successRuns = 0;
    let failedRuns = 0;
    let responseSum = 0;
    let responseCount = 0;

    for (const log of logs) {
      if (
        log.status === SyncLogStatus.SUCCESS ||
        log.status === SyncLogStatus.PARTIAL
      ) {
        successRuns += 1;
      } else if (log.status === SyncLogStatus.FAILED) {
        failedRuns += 1;
      }
      if (log.completedAt) {
        const ms = log.completedAt.getTime() - log.startedAt.getTime();
        if (ms >= 0) {
          responseSum += ms;
          responseCount += 1;
        }
      }
    }

    const totalRuns = successRuns + failedRuns;
    const successRate =
      totalRuns > 0 ? Math.round((successRuns / totalRuns) * 1000) / 10 : 0;
    const avgResponseTimeMs =
      responseCount > 0 ? Math.round(responseSum / responseCount) : null;

    return {
      successRuns,
      failedRuns,
      totalRuns,
      successRate,
      avgResponseTimeMs,
    };
  }

  private async buildHealthResponse(input: {
    organizationId: string;
    platformKey: string;
    isActive: boolean;
    lastSyncAt: Date | null;
    lastErrorAt: Date | null;
    lastErrorMessage: string | null;
    syncErrorCount: number;
    window: SyncWindowStats;
  }): Promise<ConnectionHealthResponse> {
    const {
      organizationId,
      platformKey,
      isActive,
      lastSyncAt,
      lastErrorAt,
      lastErrorMessage,
      syncErrorCount,
      window,
    } = input;

    const status = this.deriveStatus(
      isActive,
      lastSyncAt,
      window.totalRuns,
      window.successRate,
    );

    const circuit = await this.platformHealth.getPlatformHealth(platformKey);
    const limit = getRateLimitConfig(platformKey).burstLimit;
    const remaining = await this.rateLimiter.remaining(
      platformKey,
      organizationId,
    );
    const resetAt = await this.rateLimiter.nextAvailableAt(
      platformKey,
      organizationId,
    );

    return {
      status,
      lastSuccessAt: lastSyncAt?.toISOString() ?? null,
      lastErrorAt: lastErrorAt?.toISOString() ?? null,
      lastErrorMessage,
      circuitBreaker: circuit.state,
      rateLimit: {
        remaining,
        limit,
        resetAt: resetAt.toISOString(),
      },
      consecutiveErrors: syncErrorCount,
      responseTimeMs: window.avgResponseTimeMs,
    };
  }

  private deriveStatus(
    isActive: boolean,
    lastSyncAt: Date | null,
    totalRuns24h: number,
    successRate: number,
  ): ConnectionHealthStatus {
    if (!isActive) {
      return 'unknown';
    }
    if (lastSyncAt === null && totalRuns24h === 0) {
      return 'unknown';
    }
    if (lastSyncAt !== null) {
      const staleMs = Date.now() - lastSyncAt.getTime();
      if (staleMs > STALE_SYNC_MS) {
        return 'error';
      }
    }
    if (totalRuns24h === 0) {
      return lastSyncAt !== null ? 'warning' : 'unknown';
    }
    if (successRate >= 95) {
      return 'healthy';
    }
    if (successRate >= 80) {
      return 'warning';
    }
    return 'error';
  }
}
