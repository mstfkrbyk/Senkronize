import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ErpType, SyncFrequency } from '@prisma/client';

import { BizimHesapRateLimitService } from '../adapters/erp/bizimhesap/bizimhesap-rate-limit.service';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ErpSyncSettings } from '@prisma/client';

@Injectable()
export class ErpSyncTask {
  private readonly logger = new Logger(ErpSyncTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly erpSyncSettingsService: ErpSyncSettingsService,
    private readonly bizimHesapRateLimit: BizimHesapRateLimitService,
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

    const bizimHesapDue = due.filter(
      (settings) => settings.erpConnection.erpType === ErpType.BIZIMHESAP,
    );
    const otherDue = due.filter(
      (settings) => settings.erpConnection.erpType !== ErpType.BIZIMHESAP,
    );

    let queued = 0;

    const bizimHesapByOrg = new Map<string, typeof bizimHesapDue>();
    for (const settings of bizimHesapDue) {
      const list = bizimHesapByOrg.get(settings.organizationId) ?? [];
      list.push(settings);
      bizimHesapByOrg.set(settings.organizationId, list);
    }

    for (const [organizationId, settingsList] of bizimHesapByOrg) {
      if (await this.bizimHesapRateLimit.isBlocked(organizationId)) {
        const status = await this.bizimHesapRateLimit.getStatus(organizationId);
        await this.bizimHesapRateLimit.recordSyncSkipped(
          organizationId,
          status.reason ??
            'BizimHesap istek limiti aktif — planlı senkron atlandı',
        );
        for (const settings of settingsList) {
          const nextSyncAt = await this.erpSyncSettingsService.deferNextSyncAt(
            settings,
            status.blockedUntil ? new Date(status.blockedUntil) : null,
          );
          await this.prisma.erpSyncSettings.update({
            where: { id: settings.id },
            data: { nextSyncAt },
          });
        }
        continue;
      }

      const connectionIds = settingsList.map((item) => item.erpConnectionId);
      await this.erpSyncSettingsService.enqueueBizimHesapOrgBatch(
        organizationId,
        connectionIds,
      );
      queued += 1;

      await this.deferSettingsNextSync(settingsList);
    }

    for (const settings of otherDue) {
      const count = await this.erpSyncSettingsService.enqueueSyncJobs(
        settings.erpConnection,
        settings,
      );
      if (count > 0) {
        queued += count;
      }
      await this.deferSettingsNextSync([settings]);
    }

    this.logger.log(
      `ERP zamanlanmış sync: ${String(due.length)} bağlantı, ${String(queued)} iş`,
    );
  }

  private async deferSettingsNextSync(
    settingsList: Array<
      ErpSyncSettings & {
        erpConnection: { erpType: ErpType };
      }
    >,
  ): Promise<void> {
    for (const settings of settingsList) {
      const nextSyncAt = await this.erpSyncSettingsService.getNextSyncTime({
        syncFrequency: settings.syncFrequency,
        lastSyncAt: settings.lastSyncAt,
        erpType: settings.erpConnection.erpType,
      });
      await this.prisma.erpSyncSettings.update({
        where: { id: settings.id },
        data: { nextSyncAt },
      });
    }
  }
}
