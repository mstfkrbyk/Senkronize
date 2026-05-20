import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Job } from 'bull';
import type { PriceUpdatePayload, StockUpdatePayload } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_LISTING_SYNC } from '../queue/queue.constants';
import { QUEUE_WORKER_CONCURRENCY } from '../queue/queue-worker.config';
import type {
  ListingSyncPriceJobData,
  ListingSyncPushProductJobData,
  ListingSyncStockJobData,
} from '../queue/queue.types';
import type { SyncResult } from '../sync/listing-sync.types';
import { SyncGateway } from '../sync/sync-gateway';
import { SyncLogService } from '../sync/sync-log.service';
import { SyncStatusService } from '../sync-status/sync-status.service';
import { WarehouseService } from '../warehouse/warehouse.service';

@Processor(QUEUE_LISTING_SYNC)
export class ListingSyncProcessor {
  private readonly logger = new Logger(ListingSyncProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
    private readonly prisma: PrismaService,
    private readonly syncLogService: SyncLogService,
    private readonly syncStatusService: SyncStatusService,
    private readonly syncGateway: SyncGateway,
    private readonly eventService: EventService,
    private readonly warehouseService: WarehouseService,
  ) {}

  @Process({
    name: 'push-product',
    concurrency: QUEUE_WORKER_CONCURRENCY.listingSync,
  })
  async pushProduct(
    job: Job<ListingSyncPushProductJobData>,
  ): Promise<void> {
    const { orgId, productId, platform } = job.data;
    const marketplace = platform as Marketplace;
    this.syncGateway.emitSyncStarted(orgId, platform);
    const log = await this.syncLogService.startLog(
      orgId,
      marketplace,
      'listing-sync.push-product',
    );

    try {
      const credentials =
        await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
          orgId,
          marketplace,
        );
      if (!credentials) {
        await this.syncLogService.failLog(log.id, 'Aktif bağlantı yok');
        return;
      }

      const product = await this.prisma.product.findFirst({
        where: { id: productId, organizationId: orgId, deletedAt: null },
        select: { barcode: true },
      });
      if (!product) {
        await this.syncLogService.failLog(log.id, 'Ürün bulunamadı');
        return;
      }

      const listing = await this.prisma.listing.findFirst({
        where: {
          organizationId: orgId,
          platform: marketplace,
          deletedAt: null,
          OR: [{ productId }, { barcode: product.barcode }],
        },
      });
      if (!listing) {
        await this.syncLogService.failLog(log.id, 'Listeleme bulunamadı');
        return;
      }

      const stockQty = await this.resolveStockQuantity(
        orgId,
        product.barcode,
        listing.quantity,
      );

      const adapter = this.adapterRegistry.get(platform);
      const stockUpdates: StockUpdatePayload[] = [
        { barcode: listing.barcode, quantity: stockQty },
      ];
      const priceUpdates: PriceUpdatePayload[] = [
        {
          barcode: listing.barcode,
          salePrice: Number(listing.salePrice),
          listPrice: Number(listing.listPrice),
        },
      ];

      await adapter.updateStock(credentials, stockUpdates);
      this.syncGateway.emitSyncProgress(orgId, platform, 50);
      await adapter.updatePrice(credentials, priceUpdates);

      await this.prisma.listing.update({
        where: { id: listing.id },
        data: { quantity: stockQty, lastSyncAt: new Date() },
      });

      await this.syncLogService.completeLog(log.id, 1, 0);
      await this.syncStatusService.recordSuccess(orgId, marketplace);

      const result: SyncResult = {
        platform: marketplace,
        success: true,
        itemsProcessed: 1,
      };
      this.syncGateway.emitSyncCompleted(orgId, platform, result);
      this.eventService.emit(orgId, WS_EVENTS.LISTING_SYNCED, {
        barcode: listing.barcode,
        platform,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('push-product başarısız', {
        orgId,
        productId,
        platform,
        error: message,
      });
      await this.syncLogService.failLog(log.id, message);
      await this.syncStatusService.recordError(orgId, marketplace, message);
      const result: SyncResult = {
        platform: marketplace,
        success: false,
        errorMessage: message,
      };
      this.syncGateway.emitSyncCompleted(orgId, platform, result);
      throw error;
    }
  }

  @Process('sync-stock')
  async syncStock(job: Job<ListingSyncStockJobData>): Promise<void> {
    const { orgId, barcode, stock } = job.data;
    const trimmed = barcode.trim();
    const listings = await this.prisma.listing.findMany({
      where: { organizationId: orgId, barcode: trimmed, deletedAt: null },
    });
    if (listings.length === 0) {
      return;
    }

    const byPlatform = new Map<Marketplace, typeof listings>();
    for (const row of listings) {
      const list = byPlatform.get(row.platform) ?? [];
      list.push(row);
      byPlatform.set(row.platform, list);
    }

    let processed = 0;
    let failed = 0;
    const platforms = [...byPlatform.keys()];

    for (let i = 0; i < platforms.length; i += 1) {
      const platform = platforms[i];
      const progress = Math.round(((i + 1) / platforms.length) * 100);
      this.syncGateway.emitSyncProgress(orgId, platform, progress);

      const log = await this.syncLogService.startLog(
        orgId,
        platform,
        'listing-sync.sync-stock',
      );

      try {
        const credentials =
          await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
            orgId,
            platform,
          );
        if (!credentials) {
          await this.syncLogService.failLog(log.id, 'Aktif bağlantı yok');
          failed += 1;
          continue;
        }

        const adapter = this.adapterRegistry.get(platform);
        const updates: StockUpdatePayload[] = [
          { barcode: trimmed, quantity: stock },
        ];
        await adapter.updateStock(credentials, updates);

        const rows = byPlatform.get(platform) ?? [];
        for (const listing of rows) {
          await this.prisma.listing.update({
            where: { id: listing.id },
            data: { quantity: stock, lastSyncAt: new Date() },
          });
        }

        await this.syncLogService.completeLog(log.id, rows.length, 0);
        await this.syncStatusService.recordSuccess(orgId, platform);
        processed += rows.length;
        this.eventService.emit(orgId, WS_EVENTS.LISTING_SYNCED, {
          barcode: trimmed,
          platform,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.error('sync-stock platform hatası', {
          orgId,
          barcode: trimmed,
          platform,
          error: message,
        });
        await this.syncLogService.failLog(log.id, message);
        await this.syncStatusService.recordError(orgId, platform, message);
        failed += 1;
        throw error;
      }
    }

    this.logger.log('Barkod stok senkronu tamamlandı', {
      orgId,
      barcode: trimmed,
      processed,
      failed,
    });
  }

  @Process('sync-price')
  async syncPrice(job: Job<ListingSyncPriceJobData>): Promise<void> {
    const { orgId, listingIds } = job.data;
    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        id: { in: listingIds },
        deletedAt: null,
      },
    });

    for (const listing of listings) {
      const log = await this.syncLogService.startLog(
        orgId,
        listing.platform,
        'listing-sync.sync-price',
      );
      try {
        const credentials =
          await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
            orgId,
            listing.platform,
          );
        if (!credentials) {
          await this.syncLogService.failLog(log.id, 'Aktif bağlantı yok');
          continue;
        }
        const adapter = this.adapterRegistry.get(listing.platform);
        const priceUpdates: PriceUpdatePayload[] = [
          {
            barcode: listing.barcode,
            salePrice: Number(listing.salePrice),
            listPrice: Number(listing.listPrice),
          },
        ];
        await adapter.updatePrice(credentials, priceUpdates);
        await this.prisma.listing.update({
          where: { id: listing.id },
          data: { lastSyncAt: new Date() },
        });
        await this.syncLogService.completeLog(log.id, 1, 0);
        await this.syncStatusService.recordSuccess(orgId, listing.platform);
        this.eventService.emit(orgId, WS_EVENTS.PRICE_UPDATED, {
          barcode: listing.barcode,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        await this.syncLogService.failLog(log.id, message);
        await this.syncStatusService.recordError(
          orgId,
          listing.platform,
          message,
        );
        throw error;
      }
    }
  }

  private async resolveStockQuantity(
    orgId: string,
    barcode: string,
    listingFallback: number,
  ): Promise<number> {
    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(orgId);
    const central = await this.prisma.stockEntry.findFirst({
      where: {
        organizationId: orgId,
        barcode,
        platform: null,
        warehouseId: mainWh.id,
      },
    });
    if (central) {
      return Math.max(0, central.quantity - central.reservedQty);
    }
    return listingFallback;
  }
}
