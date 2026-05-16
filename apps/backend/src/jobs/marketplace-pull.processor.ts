import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Job } from 'bull';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { OrderService } from '../order/order.service';
import { QUEUE_MARKETPLACE_PULL } from '../queue/queue.constants';
import type { MarketplacePullJobData } from '../queue/queue.types';
import { SyncStatusService } from '../sync-status/sync-status.service';

@Processor(QUEUE_MARKETPLACE_PULL)
export class MarketplacePullProcessor {
  private readonly logger = new Logger(MarketplacePullProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
    private readonly orderService: OrderService,
    private readonly syncStatusService: SyncStatusService,
    private readonly eventService: EventService,
  ) {}

  @Process('pull-orders')
  async handlePullOrders(job: Job<MarketplacePullJobData>): Promise<void> {
    const { organizationId, platform, since } = job.data;
    this.logger.log('Pazaryeri sipariş çekme işi başladı', {
      organizationId,
      platform,
    });
    try {
      const credentials =
        await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
          organizationId,
          platform as Marketplace,
        );
      if (!credentials) {
        this.logger.warn('Aktif pazaryeri bağlantısı bulunamadı', {
          organizationId,
          platform,
        });
        return;
      }
      const adapter = this.adapterRegistry.get(platform);
      const sinceDate = since ? new Date(since) : undefined;
      const orders = await adapter.getOrders(credentials, sinceDate);
      this.logger.log('Pazaryeri siparişleri alındı', {
        organizationId,
        platform,
        count: orders.length,
      });
      await this.orderService.upsertFromPlatform(
        organizationId,
        platform as Marketplace,
        orders,
      );
      await this.syncStatusService.recordSuccess(
        organizationId,
        platform as Marketplace,
      );
      this.eventService.emit(organizationId, WS_EVENTS.ORDER_NEW, {
        count: orders.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Pazaryeri sipariş çekme hatası', {
        organizationId,
        platform,
        error: message,
      });
      await this.syncStatusService.recordError(
        organizationId,
        platform as Marketplace,
        message,
      );
      throw error;
    }
  }
}
