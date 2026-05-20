import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ErpType } from '@prisma/client';
import type { Job } from 'bull';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { ErpConnectionService } from '../erp-connection/erp-connection.service';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { QUEUE_ERP_SYNC } from '../queue/queue.constants';
import type { ErpSyncJobData } from '../queue/queue.types';
import { SyncLogService } from '../sync/sync-log.service';

@Processor(QUEUE_ERP_SYNC)
export class ErpSyncProcessor {
  private readonly logger = new Logger(ErpSyncProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly erpConnectionService: ErpConnectionService,
    private readonly erpSyncSettingsService: ErpSyncSettingsService,
    private readonly syncLogService: SyncLogService,
  ) {}

  @Process('sync-products')
  async handleSyncProducts(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'products', async (adapter, credentials) => {
      const products = await adapter.getProducts(credentials);
      return { processed: products.length, failed: 0 };
    });
  }

  @Process('sync-stock')
  async handleSyncStock(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'stock', async () => {
      return { processed: 0, failed: 0 };
    });
  }

  @Process('sync-invoices')
  async handleSyncInvoices(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'invoices', async () => {
      return { processed: 0, failed: 0 };
    });
  }

  private async runSyncJob(
    job: Job<ErpSyncJobData>,
    expectedType: ErpSyncJobData['type'],
    run: (
      adapter: ReturnType<AdapterRegistry['getErp']>,
      credentials: Record<string, string>,
    ) => Promise<{ processed: number; failed: number }>,
  ): Promise<void> {
    const { organizationId, erpType, type, erpConnectionId } = job.data;
    if (type !== expectedType) {
      return;
    }
    const erp = erpType as ErpType;
    const jobType = ErpSyncSettingsService.erpSyncJobType(
      erpConnectionId,
      type,
    );
    const syncLog = await this.syncLogService.startLog(
      organizationId,
      ErpSyncSettingsService.erpSyncLogPlatform(),
      jobType,
    );

    this.logger.log('ERP senkron işi başladı', {
      organizationId,
      erpType,
      type,
      erpConnectionId,
    });

    try {
      if (!this.adapterRegistry.hasErpAdapter(erpType)) {
        this.logger.warn('ERP adaptörü tanımlı değil', { organizationId, erpType });
        await this.syncLogService.completeLog(syncLog.id, 0, 0);
        return;
      }
      const credentials =
        await this.erpConnectionService.getDecryptedCredentialsForJob(
          organizationId,
          erp,
        );
      if (!credentials) {
        this.logger.warn('Aktif ERP bağlantısı bulunamadı', {
          organizationId,
          erpType,
        });
        await this.syncLogService.failLog(
          syncLog.id,
          'Aktif ERP bağlantısı bulunamadı',
        );
        return;
      }
      const adapter = this.adapterRegistry.getErp(erpType);
      const result = await run(adapter, credentials);
      await this.syncLogService.completeLog(
        syncLog.id,
        result.processed,
        result.failed,
      );
      await this.erpConnectionService.recordSyncSuccess(organizationId, erp);
      await this.erpSyncSettingsService.markSyncCompleted(
        erpConnectionId,
        organizationId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('ERP senkron hatası', {
        organizationId,
        erpType,
        type,
        error: message,
      });
      await this.syncLogService.failLog(syncLog.id, message);
      await this.erpConnectionService.recordSyncError(
        organizationId,
        erp,
        message,
      );
      throw error;
    }
  }
}
