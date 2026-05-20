import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Marketplace, NotificationType } from '@prisma/client';
import * as Sentry from '@sentry/node';
import type { Job, Queue } from 'bull';
import type { MarketplaceListing } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { ListingService } from '../listing/listing.service';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { OrderService } from '../order/order.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnService } from '../return/return.service';
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
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly returnService: ReturnService,
    @InjectQueue(QUEUE_IMAGE)
    private readonly imageQueue: Queue<ImageUploadFromUrlJobData>,
  ) {}

  @Process('pull-orders')
  async handlePullOrders(job: Job<MarketplacePullJobData>): Promise<void> {
    return Sentry.startSpan(
      {
        name: 'marketplace-pull.pull-orders',
        op: 'queue.process',
        attributes: {
          'job.organizationId': job.data.organizationId,
          'job.platform': String(job.data.platform),
        },
      },
      async () => {
    const { organizationId, platform, since } = job.data;
    this.logger.log('Pazaryeri sipariş çekme işi başladı', {
      organizationId,
      platform,
    });
    let connectionId: string | null = null;
    try {
      const connectionRow = await this.prisma.marketplaceConnection.findFirst({
        where: {
          organizationId,
          platform: platform as Marketplace,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      connectionId = connectionRow?.id ?? null;

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
      const { createdOrders } = await this.orderService.upsertFromPlatform(
        organizationId,
        platform as Marketplace,
        orders,
      );
      for (const order of createdOrders) {
        this.eventService.emit(organizationId, WS_EVENTS.ORDER_NEW, {
          orderId: order.id,
          platform,
          buyerName: order.customerName,
          totalAmount: order.totalAmount.toString(),
          createdAt: order.createdAt.toISOString(),
        });
        try {
          await this.inAppNotificationService.create({
            organizationId,
            type: NotificationType.ORDER_NEW,
            title: 'Yeni sipariş',
            message: `${String(platform)} — No: ${order.platformOrderId} · ${order.customerName}`,
            link: '/orders',
            metadata: { orderId: order.id, platform: String(platform) },
          });
        } catch (notifyErr) {
          this.logger.warn('In-app bildirim oluşturulamadı', {
            organizationId,
            orderId: order.id,
            message:
              notifyErr instanceof Error ? notifyErr.message : 'unknown',
          });
        }
      }
      if (createdOrders.length > 0) {
        this.eventService.emit(organizationId, WS_EVENTS.DASHBOARD_UPDATE, {
          reason: 'order:new',
          count: createdOrders.length,
        });
      }
      await this.syncStatusService.recordSuccess(
        organizationId,
        platform as Marketplace,
        { ordersProcessed: orders.length },
      );
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_COMPLETED, {
        platform,
        connectionId: connectionId ?? undefined,
        ordersProcessed: orders.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Pazaryeri sipariş çekme hatası', {
        organizationId,
        platform,
        error: message,
      });
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_ERROR, {
        platform,
        connectionId: connectionId ?? undefined,
        message: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
      await this.syncStatusService.recordError(
        organizationId,
        platform as Marketplace,
        message,
      );
      throw error;
    }
      },
    );
  }

  @Process('pull-listings')
  async handlePullListings(job: Job<MarketplacePullJobData>): Promise<void> {
    return Sentry.startSpan(
      {
        name: 'marketplace-pull.pull-listings',
        op: 'queue.process',
        attributes: {
          'job.organizationId': job.data.organizationId,
          'job.platform': String(job.data.platform),
        },
      },
      async () => {
    const { organizationId, platform } = job.data;
    this.logger.log('Pazaryeri listeleme çekme işi başladı', {
      organizationId,
      platform,
    });
    let connectionId: string | null = null;
    try {
      const connectionRow = await this.prisma.marketplaceConnection.findFirst({
        where: {
          organizationId,
          platform: platform as Marketplace,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      connectionId = connectionRow?.id ?? null;

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
      const platformProductIds = all.map((l) => l.platformProductId);
      const existingRows =
        platformProductIds.length > 0
          ? await this.prisma.listing.findMany({
              where: {
                organizationId,
                platform: platform as Marketplace,
                deletedAt: null,
                platformProductId: { in: platformProductIds },
              },
              select: {
                id: true,
                platformProductId: true,
                quantity: true,
                barcode: true,
              },
            })
          : [];
      const prevByProductId = new Map(
        existingRows.map((r) => [
          r.platformProductId,
          { quantity: r.quantity, barcode: r.barcode },
        ]),
      );
      await this.listingService.upsertFromPlatform(
        organizationId,
        platform as Marketplace,
        all,
      );
      const listingIdByPlatformProductId =
        platformProductIds.length > 0
          ? new Map(
              (
                await this.prisma.listing.findMany({
                  where: {
                    organizationId,
                    platform: platform as Marketplace,
                    deletedAt: null,
                    platformProductId: { in: platformProductIds },
                  },
                  select: { id: true, platformProductId: true },
                })
              ).map((r) => [r.platformProductId, r.id] as const),
            )
          : new Map<string, string>();
      for (const listing of all) {
        const prev = prevByProductId.get(listing.platformProductId);
        if (!prev || prev.quantity === listing.quantity) {
          continue;
        }
        const barcode =
          typeof listing.barcode === 'string' && listing.barcode.length > 0
            ? listing.barcode
            : prev.barcode;
        if (!barcode) {
          continue;
        }
        this.eventService.emit(organizationId, WS_EVENTS.STOCK_UPDATED, {
          barcode,
          newQuantity: listing.quantity,
          platform,
        });
      }
      const r2PublicUrl = (this.configService.get<string>('R2_PUBLIC_URL') ?? '')
        .trim()
        .replace(/\/+$/, '');
      if (r2PublicUrl) {
        for (const listing of all) {
          const firstImage = listing.images?.[0];
          if (!firstImage || firstImage.includes(r2PublicUrl)) {
            continue;
          }
          const listingId = listingIdByPlatformProductId.get(
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
        { listingsProcessed: all.length },
      );
      this.eventService.emit(organizationId, WS_EVENTS.LISTING_SYNCED, {
        count: all.length,
      });
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_COMPLETED, {
        platform,
        connectionId: connectionId ?? undefined,
        listingsProcessed: all.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Pazaryeri listeleme çekme hatası', {
        organizationId,
        platform,
        error: message,
      });
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_ERROR, {
        platform,
        connectionId: connectionId ?? undefined,
        message: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
      await this.syncStatusService.recordError(
        organizationId,
        platform as Marketplace,
        message,
      );
      throw error;
    }
      },
    );
  }

  @Process('pull-returns')
  async handlePullReturns(job: Job<MarketplacePullJobData>): Promise<void> {
    return Sentry.startSpan(
      {
        name: 'marketplace-pull.pull-returns',
        op: 'queue.process',
        attributes: {
          'job.organizationId': job.data.organizationId,
          'job.platform': String(job.data.platform),
        },
      },
      async () => {
        const { organizationId, platform, since, connectionId } = job.data;
        this.logger.log('Pazaryeri iade çekme işi başladı', {
          organizationId,
          platform,
        });
        let connectionRowId: string | null = null;
        try {
          const connectionRow = await this.prisma.marketplaceConnection.findFirst({
            where: connectionId
              ? {
                  id: connectionId,
                  organizationId,
                  deletedAt: null,
                  isActive: true,
                }
              : {
                  organizationId,
                  platform: platform as Marketplace,
                  deletedAt: null,
                  isActive: true,
                },
            select: { id: true },
          });
          connectionRowId = connectionRow?.id ?? null;

          const credentials = connectionId
            ? await this.marketplaceConnectionService.getDecryptedCredentialsForConnection(
                organizationId,
                connectionId,
              )
            : await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
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
          if (typeof adapter.getReturns !== 'function') {
            this.logger.warn('Platform iade listesi desteklemiyor', {
              organizationId,
              platform,
            });
            return;
          }
          const sinceDate = since ? new Date(since) : undefined;
          const returns = await adapter.getReturns(credentials, sinceDate);
          const { upserted } = await this.returnService.upsertFromPlatform(
            organizationId,
            platform as Marketplace,
            returns,
          );
          this.logger.log('İadeler senkronize edildi', {
            organizationId,
            platform,
            upserted,
          });
          await this.syncStatusService.recordSuccess(
            organizationId,
            platform as Marketplace,
            { returnsProcessed: returns.length },
          );
          this.eventService.emit(organizationId, WS_EVENTS.SYNC_COMPLETED, {
            platform,
            connectionId: connectionRowId ?? undefined,
            returnsProcessed: returns.length,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Bilinmeyen hata';
          this.logger.error('Pazaryeri iade çekme hatası', {
            organizationId,
            platform,
            error: message,
          });
          this.eventService.emit(organizationId, WS_EVENTS.SYNC_ERROR, {
            platform,
            connectionId: connectionRowId ?? undefined,
            message: message.slice(0, 500),
            timestamp: new Date().toISOString(),
          });
          await this.syncStatusService.recordError(
            organizationId,
            platform as Marketplace,
            message,
          );
          throw error;
        }
      },
    );
  }
}
