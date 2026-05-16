import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { PrismaService } from '../prisma/prisma.service';
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
      platform: row.platform,
      lastSuccessAt: row.lastSyncAt,
      errorCount: row.syncErrorCount,
      status: deriveStatus(row.syncErrorCount),
    }));
  }
}
