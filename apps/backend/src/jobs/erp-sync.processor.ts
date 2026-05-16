import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ErpType } from '@prisma/client';
import type { Job } from 'bull';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { ErpConnectionService } from '../erp-connection/erp-connection.service';
import { QUEUE_ERP_SYNC } from '../queue/queue.constants';
import type { ErpSyncJobData } from '../queue/queue.types';

@Processor(QUEUE_ERP_SYNC)
export class ErpSyncProcessor {
  private readonly logger = new Logger(ErpSyncProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly erpConnectionService: ErpConnectionService,
  ) {}

  @Process('sync-products')
  async handleSyncProducts(job: Job<ErpSyncJobData>): Promise<void> {
    const { organizationId, erpType, type } = job.data;
    if (type !== 'products') {
      return;
    }
    const erp = erpType as ErpType;
    this.logger.log('ERP ürün senkron işi başladı', { organizationId, erpType });
    try {
      if (!this.adapterRegistry.hasErpAdapter(erpType)) {
        this.logger.warn('ERP adaptörü tanımlı değil', { organizationId, erpType });
        return;
      }
      const credentials = await this.erpConnectionService.getDecryptedCredentialsForJob(
        organizationId,
        erp,
      );
      if (!credentials) {
        this.logger.warn('Aktif ERP bağlantısı bulunamadı', { organizationId, erpType });
        return;
      }
      const adapter = this.adapterRegistry.getErp(erpType);
      const products = await adapter.getProducts(credentials);
      this.logger.log('ERP ürünleri alındı', {
        organizationId,
        erpType,
        count: products.length,
      });
      await this.erpConnectionService.recordSyncSuccess(organizationId, erp);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('ERP ürün senkron hatası', {
        organizationId,
        erpType,
        error: message,
      });
      await this.erpConnectionService.recordSyncError(organizationId, erp, message);
      throw error;
    }
  }
}
