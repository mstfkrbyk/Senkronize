import { InjectQueue } from '@nestjs/bull';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Queue } from 'bull';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_MARKETPLACE_PULL } from '../queue/queue.constants';
import type { MarketplacePullJobData } from '../queue/queue.types';
import type { SyncHealthStatus } from './sync-status.types';

function deriveStatus(errorCount: number): SyncHealthStatus['status'] {
  if (errorCount >= 5) {
    return 'error';
  }
  if (errorCount >= 3) {
    return 'warning';
  }
  return 'healthy';
}

@Injectable()
export class SyncStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
  ) {}

  async recordSuccess(
    organizationId: string,
    platform: Marketplace,
  ): Promise<void> {
    const conn = await this.prisma.marketplaceConnection.findFirst({
      where: {
        organizationId,
        platform,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!conn) {
      return;
    }
    const row = await this.prisma.marketplaceConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: new Date(),
        syncErrorCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
    const status: SyncHealthStatus = {
      organizationId,
      connectionId: row.id,
      platform: row.platform,
      lastSuccessAt: row.lastSyncAt,
      errorCount: row.syncErrorCount,
      status: deriveStatus(row.syncErrorCount),
    };
    this.eventService.emit(organizationId, WS_EVENTS.SYNC_STATUS, status);
  }

  async recordError(
    organizationId: string,
    platform: Marketplace,
    errorMessage?: string,
  ): Promise<void> {
    const conn = await this.prisma.marketplaceConnection.findFirst({
      where: {
        organizationId,
        platform,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!conn) {
      return;
    }
    const nextCount = conn.syncErrorCount + 1;
    const row = await this.prisma.marketplaceConnection.update({
      where: { id: conn.id },
      data: {
        syncErrorCount: nextCount,
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage
          ? errorMessage.slice(0, 2000)
          : null,
      },
    });
    const status: SyncHealthStatus = {
      organizationId,
      connectionId: row.id,
      platform: row.platform,
      lastSuccessAt: row.lastSyncAt,
      errorCount: row.syncErrorCount,
      status: deriveStatus(row.syncErrorCount),
    };
    if (row.syncErrorCount >= 3) {
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_STATUS, status);
    }
  }

  async getStatus(organizationId: string): Promise<SyncHealthStatus[]> {
    const rows = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      orderBy: { platform: 'asc' },
    });
    return rows.map((row) => ({
      organizationId,
      connectionId: row.id,
      platform: row.platform,
      lastSuccessAt: row.lastSyncAt,
      errorCount: row.syncErrorCount,
      status: deriveStatus(row.syncErrorCount),
    }));
  }

  async triggerManualSync(
    connectionId: string,
    organizationId: string,
  ): Promise<void> {
    const conn = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId,
        organizationId,
        deletedAt: null,
      },
    });
    if (!conn) {
      throw new NotFoundException('Bağlantı bulunamadı');
    }
    if (!conn.isActive) {
      throw new ForbiddenException('Pasif bağlantı için senkron tetiklenemez');
    }
    const platform = conn.platform;
    await this.marketplacePullQueue.add(
      'pull-orders',
      {
        organizationId,
        platform,
        type: 'orders',
      },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
    await this.marketplacePullQueue.add(
      'pull-listings',
      {
        organizationId,
        platform,
        type: 'listings',
      },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
    this.eventService.emit(organizationId, WS_EVENTS.SYNC_TRIGGER, {
      connectionId,
      platform,
    });
  }
}
