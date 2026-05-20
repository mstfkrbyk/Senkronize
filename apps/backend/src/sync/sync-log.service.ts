import { Injectable } from '@nestjs/common';
import {
  Marketplace,
  SyncLog,
  SyncLogStatus,
  type Prisma,
} from '@prisma/client';

import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { PrismaService } from '../prisma/prisma.service';

import type { SyncResult } from './listing-sync.types';
import { SyncGateway } from './sync-gateway';

export interface PlatformSyncStat {
  platform: Marketplace;
  totalRuns: number;
  successRuns: number;
  partialRuns: number;
  failedRuns: number;
  successRate: number;
  lastRunAt: string | null;
  lastStatus: SyncLogStatus | null;
}

export interface ListingSyncCompletion {
  logId: string;
  platform: Marketplace;
  itemsProcessed: number;
  itemsFailed: number;
  durationMs: number;
  status: SyncLogStatus;
}

@Injectable()
export class SyncLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly syncGateway: SyncGateway,
  ) {}

  async startLog(
    orgId: string,
    platform: Marketplace,
    jobType: string,
  ): Promise<SyncLog> {
    return this.prisma.syncLog.create({
      data: {
        organizationId: orgId,
        platform,
        jobType,
        status: SyncLogStatus.RUNNING,
      },
    });
  }

  async completeLog(
    logId: string,
    itemsProcessed: number,
    itemsFailed = 0,
  ): Promise<void> {
    const status = this.resolveStatus(itemsProcessed, itemsFailed);
    await this.prisma.syncLog.update({
      where: { id: logId },
      data: {
        status,
        itemsProcessed,
        itemsFailed,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async failLog(logId: string, errorMessage: string): Promise<void> {
    await this.prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: SyncLogStatus.FAILED,
        completedAt: new Date(),
        errorMessage: errorMessage.slice(0, 2000),
      },
    });
  }

  /** Listing sync tamamlandığında log yazar ve WebSocket olayları yayınlar. */
  async completeListingSync(
    orgId: string,
    platform: Marketplace,
    logId: string,
    startedAt: Date,
    itemsProcessed: number,
    itemsFailed: number,
    jobType: string,
  ): Promise<ListingSyncCompletion> {
    const status = this.resolveStatus(itemsProcessed, itemsFailed);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await this.prisma.syncLog.update({
      where: { id: logId },
      data: {
        status,
        itemsProcessed,
        itemsFailed,
        completedAt,
        errorMessage:
          itemsFailed > 0 && itemsProcessed === 0
            ? `${String(itemsFailed)} öğe başarısız`
            : null,
      },
    });

    const result: SyncResult = {
      platform,
      success: status !== SyncLogStatus.FAILED,
      itemsProcessed,
      ...(itemsFailed > 0 ? { errorMessage: `${String(itemsFailed)} hatalı` } : {}),
    };

    this.syncGateway.emitSyncCompleted(orgId, platform, result);
    this.eventService.emit(orgId, WS_EVENTS.SYNC_COMPLETED, {
      platform,
      jobType,
      itemsProcessed,
      itemsFailed,
      durationMs,
      status,
    });

    return {
      logId,
      platform,
      itemsProcessed,
      itemsFailed,
      durationMs,
      status,
    };
  }

  async getRecentLogs(
    orgId: string,
    options?: {
      platform?: Marketplace;
      status?: SyncLogStatus;
      limit?: number;
      jobTypeStartsWith?: string;
    },
  ): Promise<SyncLog[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const where: Prisma.SyncLogWhereInput = {
      organizationId: orgId,
    };
    if (options?.platform) {
      where.platform = options.platform;
    }
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.jobTypeStartsWith) {
      where.jobType = { startsWith: options.jobTypeStartsWith };
    }
    return this.prisma.syncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async getPlatformSyncStats(orgId: string): Promise<PlatformSyncStat[]> {
    const rows = await this.prisma.syncLog.groupBy({
      by: ['platform', 'status'],
      where: {
        organizationId: orgId,
        status: { not: SyncLogStatus.RUNNING },
      },
      _count: { _all: true },
    });

    const lastByPlatform = await this.prisma.syncLog.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: 'desc' },
      distinct: ['platform'],
      select: {
        platform: true,
        startedAt: true,
        status: true,
      },
    });
    const lastMap = new Map(
      lastByPlatform.map((r) => [r.platform, r] as const),
    );

    const platformSet = new Set<Marketplace>();
    for (const row of rows) {
      platformSet.add(row.platform);
    }
    for (const row of lastByPlatform) {
      platformSet.add(row.platform);
    }

    const stats: PlatformSyncStat[] = [];
    for (const platform of platformSet) {
      const platformRows = rows.filter((r) => r.platform === platform);
      let successRuns = 0;
      let partialRuns = 0;
      let failedRuns = 0;
      for (const r of platformRows) {
        const count = r._count._all;
        if (r.status === SyncLogStatus.SUCCESS) {
          successRuns += count;
        } else if (r.status === SyncLogStatus.PARTIAL) {
          partialRuns += count;
        } else if (r.status === SyncLogStatus.FAILED) {
          failedRuns += count;
        }
      }
      const totalRuns = successRuns + partialRuns + failedRuns;
      const successRate =
        totalRuns > 0
          ? Math.round((successRuns / totalRuns) * 1000) / 10
          : 0;
      const last = lastMap.get(platform);
      stats.push({
        platform,
        totalRuns,
        successRuns,
        partialRuns,
        failedRuns,
        successRate,
        lastRunAt: last?.startedAt.toISOString() ?? null,
        lastStatus: last?.status ?? null,
      });
    }

    return stats.sort((a, b) => a.platform.localeCompare(b.platform));
  }

  private resolveStatus(
    itemsProcessed: number,
    itemsFailed: number,
  ): SyncLogStatus {
    if (itemsFailed > 0 && itemsProcessed > 0) {
      return SyncLogStatus.PARTIAL;
    }
    if (itemsFailed > 0) {
      return SyncLogStatus.FAILED;
    }
    return SyncLogStatus.SUCCESS;
  }
}
