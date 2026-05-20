import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Job } from 'bull';
import type { PriceUpdatePayload, StockUpdatePayload } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { RedisRateLimiter } from '../adapters/common/redis-rate-limiter';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_LISTING_SYNC } from '../queue/queue.constants';
import { QUEUE_WORKER_CONCURRENCY } from '../queue/queue-worker.config';
import type {
  ListingSyncBatchJobData,
  ListingSyncBatchUpdate,
  ListingSyncPriceJobData,
  ListingSyncPushProductJobData,
  ListingSyncStockJobData,
} from '../queue/queue.types';
import { SyncGateway } from '../sync/sync-gateway';
import { SyncLogService } from '../sync/sync-log.service';
import { SyncStatusService } from '../sync-status/sync-status.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { getListingSyncBatchLimit } from '../sync/listing-sync-batch.config';

type BatchSyncMode = 'stock' | 'price' | 'both';

interface BatchItemOutcome {
  barcode: string;
  listingIds: string[];
  success: boolean;
  error?: string;
  stock?: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size < 1) {
    return [arr];
  }
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, (i + 1) * size),
  );
}

function extractOrgId(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.orgId === 'string') {
    return record.orgId;
  }
  if (typeof record.organizationId === 'string') {
    return record.organizationId;
  }
  return undefined;
}

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
    private readonly rateLimiter: RedisRateLimiter,
  ) {}

  @Process({
    name: 'push-product',
    concurrency: QUEUE_WORKER_CONCURRENCY.listingSync,
  })
  async pushProduct(job: Job<ListingSyncPushProductJobData>): Promise<void> {
    const { orgId, productId, platform } = job.data;
    const marketplace = platform as Marketplace;
    this.syncGateway.emitSyncStarted(orgId, platform);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { barcode: true },
    });
    if (!product) {
      const log = await this.syncLogService.startLog(
        orgId,
        marketplace,
        'listing-sync.push-product',
      );
      await this.syncLogService.failLog(log.id, 'Ürün bulunamadı');
      return;
    }

    const listing = await this.prisma.listing.findFirst({
      where: {
        organizationId: orgId,
        platform: marketplace,
        deletedAt: null,
        isActive: true,
        OR: [{ productId }, { barcode: product.barcode }],
      },
    });
    if (!listing) {
      const log = await this.syncLogService.startLog(
        orgId,
        marketplace,
        'listing-sync.push-product',
      );
      await this.syncLogService.failLog(log.id, 'Listeleme bulunamadı');
      return;
    }

    const stockQty = await this.resolveStockQuantity(
      orgId,
      product.barcode,
      listing.quantity,
    );

    await this.processListingSyncBatch({
      orgId,
      platform: marketplace,
      updates: [
        {
          barcode: listing.barcode,
          stock: stockQty,
          price: Number(listing.salePrice),
          listPrice: Number(listing.listPrice),
          listingId: listing.id,
        },
      ],
      mode: 'both',
      jobType: 'listing-sync.push-product',
    });

    this.eventService.emit(orgId, WS_EVENTS.LISTING_SYNCED, {
      barcode: listing.barcode,
      platform,
    });
  }

  @Process('sync-batch')
  async syncBatch(job: Job<ListingSyncBatchJobData>): Promise<void> {
    const { orgId, platform, updates } = job.data;
    const hasStock = updates.some((u) => u.stock !== undefined);
    const hasPrice = updates.some(
      (u) => u.price !== undefined || u.listPrice !== undefined,
    );
    const mode: BatchSyncMode =
      hasStock && hasPrice ? 'both' : hasPrice ? 'price' : 'stock';

    const { processed, failed } = await this.processListingSyncBatch({
      orgId,
      platform: platform as Marketplace,
      updates,
      mode,
      jobType: 'listing-sync.sync-batch',
    });

    if (job.data.dlqReplay && failed > 0 && processed === 0) {
      throw new Error('DLQ yeniden deneme başarısız');
    }
    if (failed > 0 && processed === 0) {
      throw new Error(`${String(failed)} öğe senkronize edilemedi`);
    }
  }

  @Process('sync-stock')
  async syncStock(job: Job<ListingSyncStockJobData>): Promise<void> {
    const { orgId, barcode, stock } = job.data;
    const trimmed = barcode.trim();
    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        barcode: trimmed,
        deletedAt: null,
        isActive: true,
      },
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
      const platform = platforms[i]!;
      const progress = Math.round(((i + 1) / platforms.length) * 100);
      this.syncGateway.emitSyncProgress(orgId, platform, progress);

      const rows = byPlatform.get(platform) ?? [];
      const result = await this.processListingSyncBatch({
        orgId,
        platform,
        updates: rows.map((listing) => ({
          barcode: trimmed,
          stock,
          listingId: listing.id,
        })),
        mode: 'stock',
        jobType: 'listing-sync.sync-stock',
      });
      processed += result.processed;
      failed += result.failed;

      if (result.processed > 0) {
        this.eventService.emit(orgId, WS_EVENTS.LISTING_SYNCED, {
          barcode: trimmed,
          platform,
        });
      }
    }

    this.logger.log('Barkod stok senkronu tamamlandı', {
      orgId,
      barcode: trimmed,
      processed,
      failed,
    });

    if (failed > 0 && processed === 0) {
      throw new Error(`${String(failed)} platform stok senkronu başarısız`);
    }
  }

  @Process('sync-price')
  async syncPrice(job: Job<ListingSyncPriceJobData>): Promise<void> {
    const { orgId, listingIds } = job.data;
    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        id: { in: listingIds },
        deletedAt: null,
        isActive: true,
      },
    });
    if (listings.length === 0) {
      return;
    }

    const byPlatform = new Map<Marketplace, typeof listings>();
    for (const listing of listings) {
      const list = byPlatform.get(listing.platform) ?? [];
      list.push(listing);
      byPlatform.set(listing.platform, list);
    }

    let processed = 0;
    let failed = 0;

    for (const [platform, rows] of byPlatform) {
      const result = await this.processListingSyncBatch({
        orgId,
        platform,
        updates: rows.map((listing) => ({
          barcode: listing.barcode,
          price: Number(listing.salePrice),
          listPrice: Number(listing.listPrice),
          listingId: listing.id,
        })),
        mode: 'price',
        jobType: 'listing-sync.sync-price',
      });
      processed += result.processed;
      failed += result.failed;

      if (result.processed > 0) {
        this.eventService.emit(orgId, WS_EVENTS.PRICE_UPDATED, {
          barcode: rows[0]?.barcode,
        });
      }
    }

    if (failed > 0 && processed === 0) {
      throw new Error(`${String(failed)} fiyat senkronu başarısız`);
    }
  }

  /** Platform batch API ile toplu güncelleme; hatalı öğeleri yalıtır. */
  async processListingSyncBatch(params: {
    orgId: string;
    platform: Marketplace;
    updates: ListingSyncBatchUpdate[];
    mode: BatchSyncMode;
    jobType: string;
  }): Promise<{ processed: number; failed: number }> {
    const { orgId, platform, updates, mode, jobType } = params;
    if (updates.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const startedAt = new Date();
    this.syncGateway.emitSyncStarted(orgId, platform);
    const log = await this.syncLogService.startLog(orgId, platform, jobType);

    try {
      const credentials =
        await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
          orgId,
          platform,
        );
      if (!credentials) {
        await this.syncLogService.failLog(log.id, 'Aktif bağlantı yok');
        await this.syncStatusService.recordError(
          orgId,
          platform,
          'Aktif bağlantı yok',
        );
        this.syncGateway.emitSyncCompleted(orgId, platform, {
          platform,
          success: false,
          errorMessage: 'Aktif bağlantı yok',
        });
        return { processed: 0, failed: updates.length };
      }

      await this.rateLimiter.acquireBatchWithRetry(
        platform,
        orgId,
        updates.length,
      );

      const adapter = this.adapterRegistry.get(platform);
      const batchLimit = getListingSyncBatchLimit(platform);
      const outcomes = await this.applyUpdatesWithIsolation(
        adapter,
        credentials,
        updates,
        mode,
        batchLimit,
        orgId,
        platform,
      );

      let processed = 0;
      let failed = 0;
      const now = new Date();

      for (const outcome of outcomes) {
        if (!outcome.success) {
          failed += 1;
          continue;
        }
        processed += 1;
        for (const listingId of outcome.listingIds) {
          const data: {
            lastSyncAt: Date;
            quantity?: number;
          } = { lastSyncAt: now };
          if (outcome.stock !== undefined) {
            data.quantity = outcome.stock;
          }
          await this.prisma.listing.update({
            where: { id: listingId },
            data,
          });
        }
      }

      await this.syncLogService.completeListingSync(
        orgId,
        platform,
        log.id,
        startedAt,
        processed,
        failed,
        jobType,
      );

      if (processed > 0) {
        await this.syncStatusService.recordSuccess(orgId, platform);
      }
      if (failed > 0) {
        await this.syncStatusService.recordError(
          orgId,
          platform,
          `${String(failed)} öğe başarısız`,
        );
      }

      this.syncGateway.emitSyncProgress(orgId, platform, 100);

      return { processed, failed };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Listing sync batch başarısız', {
        orgId,
        platform,
        jobType,
        error: message,
      });
      await this.syncLogService.failLog(log.id, message);
      await this.syncStatusService.recordError(orgId, platform, message);
      this.syncGateway.emitSyncCompleted(orgId, platform, {
        platform,
        success: false,
        errorMessage: message,
      });
      throw error;
    }
  }

  private async applyUpdatesWithIsolation(
    adapter: ReturnType<AdapterRegistry['get']>,
    credentials: Record<string, string>,
    updates: ListingSyncBatchUpdate[],
    mode: BatchSyncMode,
    batchLimit: number,
    orgId: string,
    platform: Marketplace,
  ): Promise<BatchItemOutcome[]> {
    const outcomes: BatchItemOutcome[] = updates.map((u) => ({
      barcode: u.barcode,
      listingIds: u.listingId ? [u.listingId] : [],
      success: false,
      stock: u.stock,
    }));

    const chunks = chunkArray(updates, batchLimit);

    for (const chunk of chunks) {
      const chunkOutcomes = await this.processChunk(
        adapter,
        credentials,
        chunk,
        mode,
        orgId,
        platform,
      );
      for (const outcome of chunkOutcomes) {
        const idx = outcomes.findIndex(
          (o) =>
            o.barcode === outcome.barcode &&
            (outcome.listingIds.length === 0 ||
              o.listingIds.some((id) => outcome.listingIds.includes(id))),
        );
        if (idx >= 0) {
          outcomes[idx] = outcome;
        } else {
          outcomes.push(outcome);
        }
      }
    }

    return outcomes;
  }

  private async processChunk(
    adapter: ReturnType<AdapterRegistry['get']>,
    credentials: Record<string, string>,
    chunk: ListingSyncBatchUpdate[],
    mode: BatchSyncMode,
    orgId: string,
    platform: Marketplace,
  ): Promise<BatchItemOutcome[]> {
    const tryBatch = async (): Promise<BatchItemOutcome[]> => {
      if (mode === 'stock' || mode === 'both') {
        const stockUpdates: StockUpdatePayload[] = chunk.map((u) => ({
          barcode: u.barcode,
          quantity: u.stock ?? 0,
        }));
        await adapter.updateStock(credentials, stockUpdates);
      }
      if (mode === 'price' || mode === 'both') {
        const priceUpdates: PriceUpdatePayload[] = chunk.map((u) => ({
          barcode: u.barcode,
          salePrice: u.price ?? 0,
          listPrice: u.listPrice ?? u.price ?? 0,
        }));
        await adapter.updatePrice(credentials, priceUpdates);
      }
      return chunk.map((u) => ({
        barcode: u.barcode,
        listingIds: u.listingId ? [u.listingId] : [],
        success: true,
        stock: u.stock,
      }));
    };

    try {
      return await tryBatch();
    } catch (batchError) {
      const batchMessage =
        batchError instanceof Error ? batchError.message : 'Toplu güncelleme hatası';
      this.logger.warn('Batch API başarısız — öğe bazlı denenecek', {
        orgId,
        platform,
        chunkSize: chunk.length,
        error: batchMessage,
      });
    }

    const itemOutcomes: BatchItemOutcome[] = [];
    for (const item of chunk) {
      try {
        if (mode === 'stock' || mode === 'both') {
          await adapter.updateStock(credentials, [
            { barcode: item.barcode, quantity: item.stock ?? 0 },
          ]);
        }
        if (mode === 'price' || mode === 'both') {
          await adapter.updatePrice(credentials, [
            {
              barcode: item.barcode,
              salePrice: item.price ?? 0,
              listPrice: item.listPrice ?? item.price ?? 0,
            },
          ]);
        }
        itemOutcomes.push({
          barcode: item.barcode,
          listingIds: item.listingId ? [item.listingId] : [],
          success: true,
          stock: item.stock,
        });
      } catch (itemError) {
        const message =
          itemError instanceof Error ? itemError.message : 'Bilinmeyen hata';
        this.logger.error('Listing sync öğe hatası', {
          orgId,
          platform,
          barcode: item.barcode,
          error: message,
        });
        itemOutcomes.push({
          barcode: item.barcode,
          listingIds: item.listingId ? [item.listingId] : [],
          success: false,
          error: message,
          stock: item.stock,
        });
      }
    }

    return itemOutcomes;
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

export { extractOrgId as extractListingSyncOrgId };
