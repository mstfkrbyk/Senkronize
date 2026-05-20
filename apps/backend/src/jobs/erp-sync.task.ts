import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SyncFrequency } from '@prisma/client';

import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ErpSyncTask {
  private readonly logger = new Logger(ErpSyncTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly erpSyncSettingsService: ErpSyncSettingsService,
  ) {}

  /** Her dakika zamanı gelen ERP senkron işlerini kuyruğa alır */
  @Cron('* * * * *')
  async scheduleDueErpSyncs(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.erpSyncSettings.findMany({
      where: {
        nextSyncAt: { lte: now },
        syncFrequency: { not: SyncFrequency.MANUAL },
        erpConnection: {
          isActive: true,
          deletedAt: null,
        },
      },
      include: { erpConnection: true },
      take: 100,
    });

    if (due.length === 0) {
      return;
    }

    let queued = 0;
    for (const settings of due) {
      const count = await this.erpSyncSettingsService.enqueueSyncJobs(
        settings.erpConnection,
        settings,
      );
      if (count > 0) {
        queued += count;
      }
      const nextSyncAt = this.erpSyncSettingsService.getNextSyncTime({
        syncFrequency: settings.syncFrequency,
        lastSyncAt: settings.lastSyncAt,
      });
      await this.prisma.erpSyncSettings.update({
        where: { id: settings.id },
        data: { nextSyncAt },
      });
    }

    this.logger.log(
      `ERP zamanlanmış sync: ${String(due.length)} bağlantı, ${String(queued)} iş`,
    );
  }
}
