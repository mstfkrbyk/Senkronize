import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';

import { PlatformHealthService } from '../adapters/common/platform-health.service';
import { RedisRateLimiter } from '../adapters/common/redis-rate-limiter';
import { RateLimitMonitorService } from '../monitoring/rate-limit-monitor.service';
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
import { OrderPullService } from '../order/order-pull.service';
import { OrderService } from '../order/order.service';
import { NotificationEmitService } from '../notifications/notification-emit.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnService } from '../return/return.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_IMAGE, QUEUE_MARKETPLACE_PULL } from '../queue/queue.constants';
import type {
  ImageUploadFromUrlJobData,
  MarketplacePullJobData,
} from '../queue/queue.types';
import { DashboardGateway } from '../dashboard/dashboard.gateway';
import { SyncLogService } from '../sync/sync-log.service';
import { SyncStatusService } from '../sync-status/sync-status.service';

@Processor(QUEUE_MARKETPLACE_PULL)
export class MarketplacePullProcessor {
  private readonly logger = new Logger(MarketplacePullProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
    private readonly orderService: OrderService,
    private readonly orderPullService: OrderPullService,
    private readonly listingService: ListingService,
    private readonly syncStatusService: SyncStatusService,
    private readonly syncLogService: SyncLogService,
    private readonly eventService: EventService,
    private readonly notificationEmit: NotificationEmitService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly returnService: ReturnService,
    private readonly dashboardGateway: DashboardGateway,
    @InjectQueue(QUEUE_IMAGE)
    private readonly imageQueue: Queue<ImageUploadFromUrlJobData>,
    private readonly redisRateLimiter: RedisRateLimiter,
    private readonly platformHealth: PlatformHealthService,
    private readonly rateLimitMonitor: RateLimitMonitorService,
  ) {}

  private async guardPlatformApi(
    platform: string,
    organizationId: string,
  ): Promise<void> {
    await this.platformHealth.checkCircuitBreaker(platform, organizationId);
    await this.redisRateLimiter.acquireWithRetry(platform, organizationId);
    void this.rateLimitMonitor.recordPlatformRequest(platform, organizationId);
  }

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
    const { organizationId, platform, since, type } = job.data;
    const syncStartedAt = Date.now();
    const marketplace = platform as Marketplace;
    const syncLog = await this.syncLogService.startLog(
      organizationId,
      marketplace,
      type,
    );
    this.logger.log('Pazaryeri sipariş çekme işi başladı', {
      organizationId,
      platform,
    });
    let connectionId: string | null = null;
    const emitSyncProgress = (current: number, total: number): void => {
      if (!connectionId) {
        return;
      }
      this.notificationEmit.emitSyncProgress(organizationId, {
        connectionId,
        platform: String(platform),
        phase: 'orders',
        current,
        total,
      });
    };
    try {
      await this.guardPlatformApi(platform, organizationId);

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
      emitSyncProgress(0, 0);

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
        await this.syncLogService.completeLog(syncLog.id, 0);
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
      emitSyncProgress(0, orders.length);
      const { createdOrders } = await this.orderPullService.persistOrders(
        organizationId,
        marketplace,
        orders,
      );
      for (let i = 0; i < createdOrders.length; i++) {
        const order = createdOrders[i];
        if ((i + 1) % 50 === 0 || i === createdOrders.length - 1) {
          emitSyncProgress(i + 1, orders.length);
        }
        this.notificationEmit.emitOrderNew(organizationId, {
          orderId: order.id,
          platform: String(platform),
          amount: order.totalAmount.toString(),
          customer: order.customerName,
        });
        this.dashboardGateway.emitOrderNew(organizationId, {
          orderId: order.id,
          platform: String(platform),
          amount: order.totalAmount.toString(),
          customer: order.customerName,
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
      const failedCount = Math.max(0, orders.length - createdOrders.length);
      await this.syncLogService.completeLog(
        syncLog.id,
        orders.length,
        failedCount,
      );
      await this.syncStatusService.recordSuccess(
        organizationId,
        marketplace,
        { ordersProcessed: orders.length },
      );
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_COMPLETED, {
        platform,
        connectionId: connectionId ?? undefined,
        ordersProcessed: orders.length,
        timestamp: new Date().toISOString(),
      });
      if (connectionId) {
        this.notificationEmit.emitSyncCompleted(organizationId, {
          connectionId,
          platform: String(platform),
          processed: orders.length,
          duration: Date.now() - syncStartedAt,
        });
      }
      await this.platformHealth.recordSuccess(platform, organizationId);
      this.orderService.recordOrdersSynced(
        organizationId,
        marketplace,
        orders.length,
        Date.now() - syncStartedAt,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      await this.platformHealth.recordError(platform, organizationId);
      this.logger.error('Pazaryeri sipariş çekme hatası', {
        organizationId,
        platform,
        error: message,
      });
      await this.syncLogService.failLog(syncLog.id, message);
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_ERROR, {
        platform,
        connectionId: connectionId ?? undefined,
        message: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
      if (connectionId) {
        this.notificationEmit.emitSyncError(organizationId, {
          connectionId,
          platform: String(platform),
          error: message.slice(0, 500),
        });
      }
      await this.syncStatusService.recordError(
        organizationId,
        marketplace,
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
    const { organizationId, platform, type } = job.data;
    const marketplace = platform as Marketplace;
    const syncLog = await this.syncLogService.startLog(
      organizationId,
      marketplace,
      type,
    );
    this.logger.log('Pazaryeri listeleme çekme işi başladı', {
      organizationId,
      platform,
    });
    let connectionId: string | null = null;
    try {
      await this.guardPlatformApi(platform, organizationId);

      const connectionRow = await this.prisma.marketplaceConnection.findFirst({
        where: {
          organizationId,
          platform: marketplace,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      connectionId = connectionRow?.id ?? null;

      const credentials =
        await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
          organizationId,
          marketplace,
        );
      if (!credentials) {
        this.logger.warn('Aktif pazaryeri bağlantısı bulunamadı', {
          organizationId,
          platform,
        });
        await this.syncLogService.completeLog(syncLog.id, 0);
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
      await this.syncLogService.completeLog(syncLog.id, all.length);
      await this.syncStatusService.recordSuccess(
        organizationId,
        marketplace,
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
      await this.platformHealth.recordSuccess(platform, organizationId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      await this.platformHealth.recordError(platform, organizationId);
      this.logger.error('Pazaryeri listeleme çekme hatası', {
        organizationId,
        platform,
        error: message,
      });
      await this.syncLogService.failLog(syncLog.id, message);
      this.eventService.emit(organizationId, WS_EVENTS.SYNC_ERROR, {
        platform,
        connectionId: connectionId ?? undefined,
        message: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
      await this.syncStatusService.recordError(
        organizationId,
        marketplace,
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
        const { organizationId, platform, since, connectionId, type } = job.data;
        const marketplace = platform as Marketplace;
        const syncLog = await this.syncLogService.startLog(
          organizationId,
          marketplace,
          type,
        );
        this.logger.log('Pazaryeri iade çekme işi başladı', {
          organizationId,
          platform,
        });
        let connectionRowId: string | null = null;
        try {
          await this.guardPlatformApi(platform, organizationId);

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
            await this.syncLogService.completeLog(syncLog.id, 0);
            return;
          }
          const adapter = this.adapterRegistry.get(platform);
          if (typeof adapter.getReturns !== 'function') {
            this.logger.warn('Platform iade listesi desteklemiyor', {
              organizationId,
              platform,
            });
            await this.syncLogService.completeLog(syncLog.id, 0);
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
          const failedCount = Math.max(0, returns.length - upserted);
          await this.syncLogService.completeLog(
            syncLog.id,
            returns.length,
            failedCount,
          );
          await this.syncStatusService.recordSuccess(
            organizationId,
            marketplace,
            { returnsProcessed: returns.length },
          );
          this.eventService.emit(organizationId, WS_EVENTS.SYNC_COMPLETED, {
            platform,
            connectionId: connectionRowId ?? undefined,
            returnsProcessed: returns.length,
            timestamp: new Date().toISOString(),
          });
          await this.platformHealth.recordSuccess(platform, organizationId);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Bilinmeyen hata';
          await this.platformHealth.recordError(platform, organizationId);
          this.logger.error('Pazaryeri iade çekme hatası', {
            organizationId,
            platform,
            error: message,
          });
          await this.syncLogService.failLog(syncLog.id, message);
          this.eventService.emit(organizationId, WS_EVENTS.SYNC_ERROR, {
            platform,
            connectionId: connectionRowId ?? undefined,
            message: message.slice(0, 500),
            timestamp: new Date().toISOString(),
          });
          await this.syncStatusService.recordError(
            organizationId,
            marketplace,
            message,
          );
          throw error;
        }
      },
    );
  }
}
