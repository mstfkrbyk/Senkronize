import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErpType,
  Marketplace,
  SyncFrequency,
  type ErpConnection,
  type ErpSyncSettings,
} from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_ERP_SYNC,
} from '../queue/queue.constants';
import type { ErpSyncJobData } from '../queue/queue.types';

import type { UpsertErpSyncSettingsDto } from './erp-sync-settings.dto';

@Injectable()
export class ErpSyncSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_ERP_SYNC)
    private readonly erpSyncQueue: Queue<ErpSyncJobData>,
  ) {}

  async getSettings(
    orgId: string,
    erpConnectionId: string,
  ): Promise<ErpSyncSettings> {
    await this.assertConnection(orgId, erpConnectionId);
    const existing = await this.prisma.erpSyncSettings.findUnique({
      where: { erpConnectionId },
    });
    if (existing) {
      return existing;
    }
    const nextSyncAt = this.getNextSyncTime({
      syncFrequency: SyncFrequency.HOURLY,
      lastSyncAt: null,
    });
    return this.prisma.erpSyncSettings.create({
      data: {
        organizationId: orgId,
        erpConnectionId,
        nextSyncAt,
      },
    });
  }

  async upsertSettings(
    orgId: string,
    erpConnectionId: string,
    dto: UpsertErpSyncSettingsDto,
  ): Promise<ErpSyncSettings> {
    await this.assertConnection(orgId, erpConnectionId);
    const current = await this.getSettings(orgId, erpConnectionId);
    const merged: ErpSyncSettings = {
      ...current,
      syncFrequency: dto.syncFrequency,
      syncStock: dto.syncStock ?? current.syncStock,
      syncProducts: dto.syncProducts ?? current.syncProducts,
      syncInvoices: dto.syncInvoices ?? current.syncInvoices,
    };
    const nextSyncAt = this.getNextSyncTime({
      syncFrequency: merged.syncFrequency,
      lastSyncAt: merged.lastSyncAt,
    });
    return this.prisma.erpSyncSettings.update({
      where: { erpConnectionId },
      data: {
        syncFrequency: merged.syncFrequency,
        syncStock: merged.syncStock,
        syncProducts: merged.syncProducts,
        syncInvoices: merged.syncInvoices,
        nextSyncAt,
      },
    });
  }

  getNextSyncTime(settings: {
    syncFrequency: SyncFrequency;
    lastSyncAt: Date | null;
  }): Date | null {
    if (settings.syncFrequency === SyncFrequency.MANUAL) {
      return null;
    }
    const now = new Date();
    if (settings.syncFrequency === SyncFrequency.REALTIME) {
      return now;
    }
    const base =
      settings.lastSyncAt && settings.lastSyncAt.getTime() <= now.getTime()
        ? settings.lastSyncAt
        : now;
    const ms = this.frequencyToMs(settings.syncFrequency);
    return new Date(base.getTime() + ms);
  }

  async createDefaultForConnection(
    organizationId: string,
    erpConnectionId: string,
  ): Promise<ErpSyncSettings> {
    const nextSyncAt = this.getNextSyncTime({
      syncFrequency: SyncFrequency.HOURLY,
      lastSyncAt: null,
    });
    return this.prisma.erpSyncSettings.upsert({
      where: { erpConnectionId },
      create: {
        organizationId,
        erpConnectionId,
        nextSyncAt,
      },
      update: {},
    });
  }

  async triggerManualSync(
    orgId: string,
    erpConnectionId: string,
  ): Promise<{ message: string }> {
    const connection = await this.assertConnection(orgId, erpConnectionId);
    if (!connection.isActive) {
      throw new BadRequestException('ERP bağlantısı pasif.');
    }
    const settings = await this.getSettings(orgId, erpConnectionId);
    const queued = await this.enqueueSyncJobs(connection, settings);
    if (queued === 0) {
      throw new BadRequestException(
        'Senkronize edilecek veri türü seçilmemiş.',
      );
    }
    return { message: 'ERP senkron işleri kuyruğa alındı' };
  }

  async enqueueSyncJobs(
    connection: ErpConnection,
    settings: ErpSyncSettings,
  ): Promise<number> {
    const jobs: ErpSyncJobData[] = [];
    if (settings.syncProducts) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'pull',
        type: 'products',
      });
    }
    if (settings.syncStock) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'pull',
        type: 'stock',
      });
    }
    if (settings.syncInvoices) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'push',
        type: 'invoices',
      });
    }
    for (const payload of jobs) {
      const jobName =
        payload.type === 'products'
          ? 'sync-products'
          : payload.type === 'stock'
            ? 'sync-stock'
            : 'sync-invoices';
      await this.erpSyncQueue.add(jobName, payload, JOB_DEFAULT_OPTIONS);
    }
    return jobs.length;
  }

  /** Teslim edilen sipariş için ERP fatura işi kuyruğa alır */
  async enqueueOrderInvoicePush(
    organizationId: string,
    orderId: string,
  ): Promise<void> {
    const connections = await this.prisma.erpConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      include: { syncSettings: true },
    });
    for (const connection of connections) {
      if (connection.syncSettings && !connection.syncSettings.syncInvoices) {
        continue;
      }
      const payload: ErpSyncJobData = {
        organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'push',
        type: 'invoices',
        orderId,
      };
      await this.erpSyncQueue.add('push-order-invoice', payload, JOB_DEFAULT_OPTIONS);
    }
  }

  /** Stok değişikliğini ERP'ye push eder */
  async enqueueStockPush(
    organizationId: string,
    barcode: string,
    quantity: number,
  ): Promise<void> {
    const connections = await this.prisma.erpConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      include: { syncSettings: true },
    });
    for (const connection of connections) {
      if (connection.syncSettings && !connection.syncSettings.syncStock) {
        continue;
      }
      const payload: ErpSyncJobData = {
        organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'push',
        type: 'stock',
        barcode,
        quantity,
      };
      await this.erpSyncQueue.add('push-stock-to-erp', payload, JOB_DEFAULT_OPTIONS);
    }
  }

  async markSyncCompleted(
    erpConnectionId: string,
    organizationId: string,
  ): Promise<void> {
    const settings = await this.prisma.erpSyncSettings.findUnique({
      where: { erpConnectionId },
    });
    if (!settings || settings.organizationId !== organizationId) {
      return;
    }
    const lastSyncAt = new Date();
    const nextSyncAt = this.getNextSyncTime({
      syncFrequency: settings.syncFrequency,
      lastSyncAt,
    });
    await this.prisma.erpSyncSettings.update({
      where: { id: settings.id },
      data: { lastSyncAt, nextSyncAt },
    });
  }

  /** SyncLog.platform alanı ERP kayıtları için sabit değer */
  static erpSyncLogPlatform(): Marketplace {
    return Marketplace.IDEASOFT;
  }

  static erpSyncJobType(erpConnectionId: string, type: string): string {
    return `erp:${erpConnectionId}:${type}`;
  }

  private frequencyToMs(frequency: SyncFrequency): number {
    switch (frequency) {
      case SyncFrequency.EVERY_15_MIN:
        return 15 * 60_000;
      case SyncFrequency.HOURLY:
        return 60 * 60_000;
      case SyncFrequency.EVERY_4_HOURS:
        return 4 * 60 * 60_000;
      case SyncFrequency.DAILY:
        return 24 * 60 * 60_000;
      default:
        return 60 * 60_000;
    }
  }

  private async assertConnection(
    orgId: string,
    erpConnectionId: string,
  ): Promise<ErpConnection> {
    const connection = await this.prisma.erpConnection.findFirst({
      where: { id: erpConnectionId, organizationId: orgId, deletedAt: null },
    });
    if (!connection) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    return connection;
  }
}
