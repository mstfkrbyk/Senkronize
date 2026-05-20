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

import { ErpManualSyncType } from '../erp-connection/erp-connection.dto';
import { NotificationEmitService } from '../notifications/notification-emit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_ERP_SYNC,
} from '../queue/queue.constants';
import type { ErpSyncJobData } from '../queue/queue.types';

import type {
  PatchErpSyncSettingsDto,
  UpsertErpSyncSettingsDto,
} from './erp-sync-settings.dto';

const SYNC_DURATION_ESTIMATE_MS: Record<ErpManualSyncType, number> = {
  [ErpManualSyncType.ALL]: 120_000,
  [ErpManualSyncType.PRODUCTS]: 60_000,
  [ErpManualSyncType.STOCK]: 30_000,
  [ErpManualSyncType.INVOICES]: 45_000,
  [ErpManualSyncType.CUSTOMERS]: 45_000,
};

const JOB_TYPE_DURATION_MS: Record<ErpSyncJobData['type'], number> = {
  products: 60_000,
  stock: 30_000,
  invoices: 45_000,
  customers: 45_000,
  orders: 45_000,
};

@Injectable()
export class ErpSyncSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEmit: NotificationEmitService,
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
      syncPrices: dto.syncPrices ?? current.syncPrices,
      syncInvoices: dto.syncInvoices ?? current.syncInvoices,
      syncCustomers: dto.syncCustomers ?? current.syncCustomers,
      autoCreateInvoice: dto.autoCreateInvoice ?? current.autoCreateInvoice,
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
        syncPrices: merged.syncPrices,
        syncInvoices: merged.syncInvoices,
        syncCustomers: merged.syncCustomers,
        autoCreateInvoice: merged.autoCreateInvoice,
        nextSyncAt,
      },
    });
  }

  async patchSettings(
    orgId: string,
    erpConnectionId: string,
    dto: PatchErpSyncSettingsDto,
  ): Promise<ErpSyncSettings> {
    await this.assertConnection(orgId, erpConnectionId);
    const current = await this.getSettings(orgId, erpConnectionId);
    const merged: ErpSyncSettings = {
      ...current,
      syncFrequency: dto.syncFrequency ?? current.syncFrequency,
      syncStock: dto.syncStock ?? current.syncStock,
      syncProducts: dto.syncProducts ?? current.syncProducts,
      syncPrices: dto.syncPrices ?? current.syncPrices,
      syncInvoices: dto.syncInvoices ?? current.syncInvoices,
      syncCustomers: dto.syncCustomers ?? current.syncCustomers,
      autoCreateInvoice: dto.autoCreateInvoice ?? current.autoCreateInvoice,
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
        syncPrices: merged.syncPrices,
        syncInvoices: merged.syncInvoices,
        syncCustomers: merged.syncCustomers,
        autoCreateInvoice: merged.autoCreateInvoice,
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
    const result = await this.triggerManualSyncWithType(
      orgId,
      erpConnectionId,
      ErpManualSyncType.ALL,
    );
    return { message: `ERP senkron kuyruğa alındı (iş: ${result.jobId})` };
  }

  async triggerManualSyncWithType(
    orgId: string,
    erpConnectionId: string,
    syncType: ErpManualSyncType,
  ): Promise<{ jobId: string; estimatedDuration: number }> {
    const connection = await this.assertConnection(orgId, erpConnectionId);
    if (!connection.isActive) {
      throw new BadRequestException('ERP bağlantısı pasif.');
    }
    const settings = await this.getSettings(orgId, erpConnectionId);
    const payloads = this.buildSyncPayloads(connection, settings, syncType);
    if (payloads.length === 0) {
      throw new BadRequestException(
        'Senkronize edilecek veri türü seçilmemiş.',
      );
    }

    let firstJobId = '';
    const total = payloads.length;
    for (let i = 0; i < payloads.length; i += 1) {
      const payload = payloads[i];
      const job = await this.erpSyncQueue.add(
        this.jobNameForType(payload.type),
        payload,
        JOB_DEFAULT_OPTIONS,
      );
      if (i === 0 && job.id !== undefined) {
        firstJobId = String(job.id);
      }
      this.notificationEmit.emitSyncProgress(orgId, {
        connectionId: erpConnectionId,
        platform: connection.erpType,
        phase: payload.type,
        current: i,
        total,
      });
    }

    this.notificationEmit.emitSyncProgress(orgId, {
      connectionId: erpConnectionId,
      platform: connection.erpType,
      phase: syncType,
      current: 0,
      total,
    });

    const estimatedDuration =
      syncType === ErpManualSyncType.ALL
        ? payloads.reduce(
            (sum, p) => sum + (JOB_TYPE_DURATION_MS[p.type] ?? 45_000),
            0,
          )
        : SYNC_DURATION_ESTIMATE_MS[syncType];

    return {
      jobId: firstJobId || 'queued',
      estimatedDuration,
    };
  }

  async enqueueSyncJobs(
    connection: ErpConnection,
    settings: ErpSyncSettings,
  ): Promise<number> {
    const payloads = this.buildSyncPayloads(
      connection,
      settings,
      ErpManualSyncType.ALL,
    );
    for (const payload of payloads) {
      await this.erpSyncQueue.add(
        this.jobNameForType(payload.type),
        payload,
        JOB_DEFAULT_OPTIONS,
      );
    }
    return payloads.length;
  }

  private buildSyncPayloads(
    connection: ErpConnection,
    settings: ErpSyncSettings,
    syncType: ErpManualSyncType,
  ): ErpSyncJobData[] {
    const jobs: ErpSyncJobData[] = [];
    const includeProducts =
      syncType === ErpManualSyncType.ALL ||
      syncType === ErpManualSyncType.PRODUCTS;
    const includeStock =
      syncType === ErpManualSyncType.ALL || syncType === ErpManualSyncType.STOCK;
    const includeInvoices =
      syncType === ErpManualSyncType.ALL ||
      syncType === ErpManualSyncType.INVOICES;
    const includeCustomers =
      syncType === ErpManualSyncType.ALL ||
      syncType === ErpManualSyncType.CUSTOMERS;

    if (includeProducts && settings.syncProducts) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'pull',
        type: 'products',
      });
    }
    if (includeStock && settings.syncStock) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'pull',
        type: 'stock',
      });
    }
    if (includeInvoices && settings.syncInvoices) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'push',
        type: 'invoices',
      });
    }
    if (includeCustomers && settings.syncCustomers) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'pull',
        type: 'customers',
      });
    }
    return jobs;
  }

  private jobNameForType(type: ErpSyncJobData['type']): string {
    switch (type) {
      case 'products':
        return 'sync-products';
      case 'stock':
        return 'sync-stock';
      case 'invoices':
        return 'sync-invoices';
      case 'customers':
        return 'sync-customers';
      default:
        return 'sync-products';
    }
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
