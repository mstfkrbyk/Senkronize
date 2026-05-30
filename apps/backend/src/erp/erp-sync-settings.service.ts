import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErpConnectionRole,
  ErpType,
  Marketplace,
  SyncFrequency,
  type ErpConnection,
  type ErpSyncSettings,
  type Prisma,
} from '@prisma/client';
import type { Queue } from 'bull';

import { ErpManualSyncType } from '../erp-connection/erp-connection.dto';
import {
  assertSecondaryErpWriteFlags,
  SECONDARY_ERP_SYNC_DEFAULTS,
} from '../erp-connection/erp-connection-role.util';
import { BizimHesapRateLimitService } from '../adapters/erp/bizimhesap/bizimhesap-rate-limit.service';
import { BizimHesapRateLimitBlockedException } from '../adapters/erp/bizimhesap/bizimhesap-rate-limit.exceptions';
import { NotificationEmitService } from '../notifications/notification-emit.service';
import { IntegrationPolicyService } from '../integration-policy/integration-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_ERP_SYNC,
} from '../queue/queue.constants';
import type { ErpSyncJobData, BizimHesapOrgSyncJobData, ErpQueueJobData } from '../queue/queue.types';

import type {
  PatchErpSyncSettingsDto,
  UpsertErpSyncSettingsDto,
} from './erp-sync-settings.dto';
import {
  buildErpSyncJobType,
  erpSyncLogPlatform,
} from './erp-sync-log.util';

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
    private readonly integrationPolicy: IntegrationPolicyService,
    private readonly bizimHesapRateLimit: BizimHesapRateLimitService,
    @InjectQueue(QUEUE_ERP_SYNC)
    private readonly erpSyncQueue: Queue<ErpQueueJobData>,
  ) {}

  async getSettings(
    orgId: string,
    erpConnectionId: string,
  ): Promise<ErpSyncSettings> {
    const connection = await this.assertConnection(orgId, erpConnectionId);
    const existing = await this.prisma.erpSyncSettings.findUnique({
      where: { erpConnectionId },
    });
    if (existing) {
      return existing;
    }
    const syncFrequency = await this.resolvePlatformSyncFrequency(connection.erpType);
    const nextSyncAt = await this.getNextSyncTime({
      syncFrequency,
      lastSyncAt: null,
      erpType: connection.erpType,
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
    const connection = await this.assertConnection(orgId, erpConnectionId);
    if (connection.role === ErpConnectionRole.SECONDARY) {
      assertSecondaryErpWriteFlags({
        syncInvoices: dto.syncInvoices,
        autoCreateInvoice: dto.autoCreateInvoice,
      });
    }
    const current = await this.getSettings(orgId, erpConnectionId);
    const platformFrequency = await this.resolvePlatformSyncFrequency(connection.erpType);
    const merged: ErpSyncSettings = {
      ...current,
      syncFrequency: platformFrequency,
      syncStock: dto.syncStock ?? current.syncStock,
      syncProducts: dto.syncProducts ?? current.syncProducts,
      syncPrices: dto.syncPrices ?? current.syncPrices,
      syncInvoices: dto.syncInvoices ?? current.syncInvoices,
      syncCustomers: dto.syncCustomers ?? current.syncCustomers,
      autoCreateInvoice: dto.autoCreateInvoice ?? current.autoCreateInvoice,
      productImportMode: dto.productImportMode ?? current.productImportMode,
      erpCategoryIds: dto.erpCategoryIds ?? current.erpCategoryIds,
    };
    const nextSyncAt = await this.getNextSyncTime({
      syncFrequency: merged.syncFrequency,
      lastSyncAt: merged.lastSyncAt,
      erpType: connection.erpType,
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
        productImportMode: merged.productImportMode,
        erpCategoryIds: merged.erpCategoryIds,
        nextSyncAt,
      },
    });
  }

  async patchSettings(
    orgId: string,
    erpConnectionId: string,
    dto: PatchErpSyncSettingsDto,
  ): Promise<ErpSyncSettings> {
    const connection = await this.assertConnection(orgId, erpConnectionId);
    if (connection.role === ErpConnectionRole.SECONDARY) {
      assertSecondaryErpWriteFlags({
        syncInvoices: dto.syncInvoices,
        autoCreateInvoice: dto.autoCreateInvoice,
      });
    }
    const current = await this.getSettings(orgId, erpConnectionId);
    const platformFrequency = await this.resolvePlatformSyncFrequency(connection.erpType);
    const merged: ErpSyncSettings = {
      ...current,
      syncFrequency: platformFrequency,
      syncStock: dto.syncStock ?? current.syncStock,
      syncProducts: dto.syncProducts ?? current.syncProducts,
      syncPrices: dto.syncPrices ?? current.syncPrices,
      syncInvoices: dto.syncInvoices ?? current.syncInvoices,
      syncCustomers: dto.syncCustomers ?? current.syncCustomers,
      autoCreateInvoice: dto.autoCreateInvoice ?? current.autoCreateInvoice,
      productImportMode: dto.productImportMode ?? current.productImportMode,
      erpCategoryIds: dto.erpCategoryIds ?? current.erpCategoryIds,
    };
    const nextSyncAt = await this.getNextSyncTime({
      syncFrequency: merged.syncFrequency,
      lastSyncAt: merged.lastSyncAt,
      erpType: connection.erpType,
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
        productImportMode: merged.productImportMode,
        erpCategoryIds: merged.erpCategoryIds,
        nextSyncAt,
      },
    });
  }

  async getNextSyncTime(settings: {
    syncFrequency: SyncFrequency;
    lastSyncAt: Date | null;
    erpType?: ErpType;
  }): Promise<Date | null> {
    const frequency = settings.syncFrequency;

    if (frequency === SyncFrequency.MANUAL) {
      return null;
    }
    const now = new Date();
    if (frequency === SyncFrequency.REALTIME && settings.erpType !== ErpType.BIZIMHESAP) {
      return now;
    }
    const base =
      settings.lastSyncAt && settings.lastSyncAt.getTime() <= now.getTime()
        ? settings.lastSyncAt
        : now;
    let ms = this.frequencyToMs(frequency);
    if (settings.erpType === ErpType.BIZIMHESAP) {
      const platformMinMs =
        await this.integrationPolicy.getMinSyncIntervalMsForHourlyCap('BIZIMHESAP');
      ms = Math.max(ms, platformMinMs);
    }
    return new Date(base.getTime() + ms);
  }

  /** 429 / saatlik kota nedeniyle atlanan senkron sonrası bir sonraki deneme zamanı */
  async deferNextSyncAt(
    settings: Pick<ErpSyncSettings, 'syncFrequency' | 'lastSyncAt'> & {
      erpConnection: Pick<ErpConnection, 'erpType'>;
    },
    blockedUntil: Date | null,
  ): Promise<Date> {
    const scheduled = await this.getNextSyncTime({
      syncFrequency: settings.syncFrequency,
      lastSyncAt: new Date(),
      erpType: settings.erpConnection.erpType,
    });
    const fromSchedule =
      scheduled ?? new Date(Date.now() + this.frequencyToMs(settings.syncFrequency));
    if (blockedUntil && blockedUntil.getTime() > fromSchedule.getTime()) {
      return blockedUntil;
    }
    return fromSchedule;
  }

  async createDefaultForConnection(
    organizationId: string,
    erpConnectionId: string,
  ): Promise<ErpSyncSettings> {
    const connection = await this.prisma.erpConnection.findFirst({
      where: { id: erpConnectionId, organizationId, deletedAt: null },
    });
    if (!connection) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    const syncFrequency = await this.resolvePlatformSyncFrequency(connection.erpType);
    const nextSyncAt = await this.getNextSyncTime({
      syncFrequency,
      lastSyncAt: null,
      erpType: connection.erpType,
    });
    const isSecondary = connection.role === ErpConnectionRole.SECONDARY;
    return this.prisma.erpSyncSettings.upsert({
      where: { erpConnectionId },
      create: {
        organizationId,
        erpConnectionId,
        syncFrequency,
        nextSyncAt,
        ...(isSecondary ? SECONDARY_ERP_SYNC_DEFAULTS : {}),
      },
      update: isSecondary ? SECONDARY_ERP_SYNC_DEFAULTS : {},
    });
  }

  async applySecondarySyncProfile(
    organizationId: string,
    erpConnectionId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.erpSyncSettings.updateMany({
      where: { erpConnectionId, organizationId },
      data: SECONDARY_ERP_SYNC_DEFAULTS,
    });
  }

  async applyPrimarySyncProfile(
    organizationId: string,
    erpConnectionId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.erpSyncSettings.updateMany({
      where: { erpConnectionId, organizationId },
      data: {
        syncInvoices: true,
        autoCreateInvoice: false,
      },
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
    if (connection.erpType === ErpType.BIZIMHESAP) {
      try {
        await this.bizimHesapRateLimit.assertCanRequest(orgId);
      } catch (error) {
        const message =
          error instanceof BizimHesapRateLimitBlockedException
            ? error.message
            : 'BizimHesap istek limiti aktif. Lütfen bekleme süresi dolunca tekrar deneyin.';
        throw new BadRequestException(message);
      }
      const bizimHesapIds = await this.listActiveBizimHesapConnectionIds(orgId);
      if (bizimHesapIds.length > 1) {
        return this.enqueueBizimHesapOrgBatch(
          orgId,
          bizimHesapIds,
          syncType,
          erpConnectionId,
        );
      }
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
      const payload: ErpSyncJobData = {
        ...payloads[i],
        batchIndex: i,
        batchTotal: total,
      };
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

  async listActiveBizimHesapConnectionIds(orgId: string): Promise<string[]> {
    const rows = await this.prisma.erpConnection.findMany({
      where: {
        organizationId: orgId,
        erpType: ErpType.BIZIMHESAP,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async enqueueBizimHesapOrgBatch(
    orgId: string,
    erpConnectionIds: string[],
    syncType: ErpManualSyncType = ErpManualSyncType.ALL,
    triggerConnectionId?: string,
  ): Promise<{ jobId: string; estimatedDuration: number }> {
    if (erpConnectionIds.length === 0) {
      throw new BadRequestException('BizimHesap bağlantısı bulunamadı.');
    }
    const payload: BizimHesapOrgSyncJobData = {
      organizationId: orgId,
      erpConnectionIds,
      syncType: this.toBizimHesapBatchSyncType(syncType),
      triggerConnectionId,
    };
    const job = await this.erpSyncQueue.add(
      'bizimhesap-org-sync',
      payload,
      JOB_DEFAULT_OPTIONS,
    );
    const notifyConnectionId = triggerConnectionId ?? erpConnectionIds[0];
    this.notificationEmit.emitSyncProgress(orgId, {
      connectionId: notifyConnectionId,
      platform: ErpType.BIZIMHESAP,
      phase: syncType,
      current: 0,
      total: erpConnectionIds.length,
    });
    const estimatedDuration =
      syncType === ErpManualSyncType.ALL
        ? erpConnectionIds.length * SYNC_DURATION_ESTIMATE_MS[ErpManualSyncType.ALL]
        : erpConnectionIds.length * (SYNC_DURATION_ESTIMATE_MS[syncType] ?? 45_000);
    return {
      jobId: job.id !== undefined ? String(job.id) : 'queued',
      estimatedDuration,
    };
  }

  async getSyncPayloadsForConnection(
    orgId: string,
    erpConnectionId: string,
    syncType: ErpManualSyncType,
  ): Promise<ErpSyncJobData[]> {
    const connection = await this.assertConnection(orgId, erpConnectionId);
    const settings = await this.getSettings(orgId, erpConnectionId);
    return this.buildSyncPayloads(connection, settings, syncType);
  }

  toManualSyncType(
    syncType: BizimHesapOrgSyncJobData['syncType'],
  ): ErpManualSyncType {
    switch (syncType) {
      case 'products':
        return ErpManualSyncType.PRODUCTS;
      case 'stock':
        return ErpManualSyncType.STOCK;
      case 'invoices':
        return ErpManualSyncType.INVOICES;
      case 'customers':
        return ErpManualSyncType.CUSTOMERS;
      default:
        return ErpManualSyncType.ALL;
    }
  }

  private toBizimHesapBatchSyncType(
    syncType: ErpManualSyncType,
  ): BizimHesapOrgSyncJobData['syncType'] {
    switch (syncType) {
      case ErpManualSyncType.PRODUCTS:
        return 'products';
      case ErpManualSyncType.STOCK:
        return 'stock';
      case ErpManualSyncType.INVOICES:
        return 'invoices';
      case ErpManualSyncType.CUSTOMERS:
        return 'customers';
      default:
        return 'all';
    }
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

    const syncProducts = includeProducts && settings.syncProducts;
    const syncStock =
      includeStock && settings.syncStock && !syncProducts;

    if (syncProducts) {
      jobs.push({
        organizationId: connection.organizationId,
        erpConnectionId: connection.id,
        erpType: connection.erpType,
        direction: 'pull',
        type: 'products',
      });
    }
    if (syncStock) {
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
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        role: ErpConnectionRole.PRIMARY,
      },
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

  /** Stok değişikliğini ERP'ye push eder (yalnızca birincil ERP) */
  async enqueueStockPush(
    organizationId: string,
    barcode: string,
    quantity: number,
  ): Promise<void> {
    const connections = await this.prisma.erpConnection.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        role: ErpConnectionRole.PRIMARY,
      },
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
      include: { erpConnection: true },
    });
    if (!settings || settings.organizationId !== organizationId) {
      return;
    }
    const lastSyncAt = new Date();
    const nextSyncAt = await this.getNextSyncTime({
      syncFrequency: settings.syncFrequency,
      lastSyncAt,
      erpType: settings.erpConnection.erpType,
    });
    await this.prisma.erpSyncSettings.update({
      where: { id: settings.id },
      data: { lastSyncAt, nextSyncAt },
    });
  }

  /** SyncLog.platform alanı Marketplace enum olduğu için ERP işleri marker ile kaydedilir; gerçek ERP tipi jobType içinde tutulur. */
  static erpSyncLogPlatform(): Marketplace {
    return erpSyncLogPlatform() as Marketplace;
  }

  static erpSyncJobType(
    erpConnectionId: string,
    erpType: string,
    type: string,
  ): string {
    return buildErpSyncJobType(erpType, erpConnectionId, type);
  }

  async resolvePlatformSyncFrequency(erpType: ErpType): Promise<SyncFrequency> {
    return this.integrationPolicy.getDefaultErpSyncFrequency(erpType);
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
