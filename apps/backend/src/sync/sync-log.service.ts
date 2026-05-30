import { Injectable } from '@nestjs/common';
import {
  Marketplace,
  SyncLog,
  SyncLogStatus,
  type Prisma,
} from '@prisma/client';

import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import {
  resolveErpSyncLogErpType,
} from '../erp/erp-sync-log.util';
import { PrismaService } from '../prisma/prisma.service';

import type { SyncResult } from './listing-sync.types';
import { SyncGateway } from './sync-gateway';

export interface PlatformSyncStat {
  platform: Marketplace | string;
  totalRuns: number;
  successRuns: number;
  partialRuns: number;
  failedRuns: number;
  successRate: number;
  lastRunAt: string | null;
  lastStatus: SyncLogStatus | null;
  /** ERP senkron istatistiği ise true */
  isErpJob?: boolean;
  /** UI etiketi (ERP türü veya pazaryeri) */
  displayPlatform?: string;
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
    const errorMessage =
      itemsFailed > 0 && itemsProcessed === 0
        ? `${String(itemsFailed)} kayıt işlenemedi`
        : null;
    await this.prisma.syncLog.update({
      where: { id: logId },
      data: {
        status,
        itemsProcessed,
        itemsFailed,
        completedAt: new Date(),
        errorMessage,
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
    const rows = await this.prisma.syncLog.findMany({
      where: {
        organizationId: orgId,
        status: { not: SyncLogStatus.RUNNING },
      },
      select: {
        platform: true,
        status: true,
        jobType: true,
        startedAt: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    const erpConnections = await this.prisma.erpConnection.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, erpType: true },
    });
    const erpTypeByConnectionId = new Map(
      erpConnections.map((c) => [c.id, c.erpType] as const),
    );

    type StatBucket = {
      totalRuns: number;
      successRuns: number;
      partialRuns: number;
      failedRuns: number;
      lastRunAt: Date | null;
      lastStatus: SyncLogStatus | null;
      isErpJob: boolean;
      displayPlatform: string;
      sortKey: string;
    };

    const buckets = new Map<string, StatBucket>();

    for (const row of rows) {
      const erpType = row.jobType.startsWith('erp:')
        ? resolveErpSyncLogErpType(row.jobType, erpTypeByConnectionId)
        : null;
      const isErpJob = erpType !== null;
      const key = isErpJob ? `erp:${erpType}` : row.platform;
      const displayPlatform = isErpJob ? erpType : row.platform;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          totalRuns: 0,
          successRuns: 0,
          partialRuns: 0,
          failedRuns: 0,
          lastRunAt: null,
          lastStatus: null,
          isErpJob,
          displayPlatform,
          sortKey: displayPlatform,
        };
        buckets.set(key, bucket);
      }

      bucket.totalRuns += 1;
      if (row.status === SyncLogStatus.SUCCESS) {
        bucket.successRuns += 1;
      } else if (row.status === SyncLogStatus.PARTIAL) {
        bucket.partialRuns += 1;
      } else if (row.status === SyncLogStatus.FAILED) {
        bucket.failedRuns += 1;
      }

      if (bucket.lastRunAt === null) {
        bucket.lastRunAt = row.startedAt;
        bucket.lastStatus = row.status;
      }
    }

    const stats: PlatformSyncStat[] = [];
    for (const bucket of buckets.values()) {
      const finishedRuns =
        bucket.successRuns + bucket.partialRuns + bucket.failedRuns;
      const successRate =
        finishedRuns > 0
          ? Math.round((bucket.successRuns / finishedRuns) * 1000) / 10
          : 0;
      stats.push({
        platform: bucket.isErpJob
          ? bucket.displayPlatform
          : (bucket.displayPlatform as Marketplace),
        totalRuns: bucket.totalRuns,
        successRuns: bucket.successRuns,
        partialRuns: bucket.partialRuns,
        failedRuns: bucket.failedRuns,
        successRate,
        lastRunAt: bucket.lastRunAt?.toISOString() ?? null,
        lastStatus: bucket.lastStatus,
        isErpJob: bucket.isErpJob,
        displayPlatform: bucket.displayPlatform,
      });
    }

    return stats.sort((a, b) =>
      (a.displayPlatform ?? String(a.platform)).localeCompare(
        b.displayPlatform ?? String(b.platform),
      ),
    );
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
