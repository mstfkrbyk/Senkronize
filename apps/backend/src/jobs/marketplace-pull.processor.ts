import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Marketplace } from '@prisma/client';
import type { Job, Queue } from 'bull';
import type { MarketplaceListing } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { ListingService } from '../listing/listing.service';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { OrderService } from '../order/order.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_IMAGE, QUEUE_MARKETPLACE_PULL } from '../queue/queue.constants';
import type {
  ImageUploadFromUrlJobData,
  MarketplacePullJobData,
} from '../queue/queue.types';
import { SyncStatusService } from '../sync-status/sync-status.service';

@Processor(QUEUE_MARKETPLACE_PULL)
export class MarketplacePullProcessor {
  private readonly logger = new Logger(MarketplacePullProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
    private readonly orderService: OrderService,
    private readonly listingService: ListingService,
    private readonly syncStatusService: SyncStatusService,
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_IMAGE)
    private readonly imageQueue: Queue<ImageUploadFromUrlJobData>,
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

  @Process('pull-listings')
  async handlePullListings(job: Job<MarketplacePullJobData>): Promise<void> {
    const { organizationId, platform } = job.data;
    this.logger.log('Pazaryeri listeleme çekme işi başladı', {
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
      const all: MarketplaceListing[] = [];
      let page = 0;
      let continuePaging = true;
      while (continuePaging) {
        const batch = await adapter.getListings(credentials, page);
        all.push(...batch.items);
        if (
          batch.items.length === 0 ||
          batch.items.length < batch.pageSize ||
          all.length >= batch.total
        ) {
          continuePaging = false;
        } else {
          page += 1;
        }
      }
      await this.listingService.upsertFromPlatform(
        organizationId,
        platform as Marketplace,
        all,
      );
      const r2PublicUrl = (this.configService.get<string>('R2_PUBLIC_URL') ?? '')
        .trim()
        .replace(/\/+$/, '');
      if (r2PublicUrl) {
        for (const listing of all) {
          const firstImage = listing.images?.[0];
          if (!firstImage || firstImage.includes(r2PublicUrl)) {
            continue;
          }
          const listingId =
            await this.listingService.findListingIdByPlatformProduct(
              organizationId,
              platform as Marketplace,
              listing.platformProductId,
            );
          if (!listingId) {
            continue;
          }
          await this.imageQueue.add(
            'upload-from-url',
            {
              organizationId,
              imageUrl: firstImage,
              resourceType: 'listing',
              resourceId: listingId,
            },
            STANDARD_QUEUE_JOB_OPTIONS,
          );
        }
      }
      await this.syncStatusService.recordSuccess(
        organizationId,
        platform as Marketplace,
      );
      this.eventService.emit(organizationId, WS_EVENTS.LISTING_SYNCED, {
        count: all.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Pazaryeri listeleme çekme hatası', {
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
