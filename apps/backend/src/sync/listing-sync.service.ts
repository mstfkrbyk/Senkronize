import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Queue } from 'bull';

import { PostHogService } from '../analytics/posthog.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LISTING_SYNC_JOB_OPTIONS,
  LISTING_SYNC_STOCK_JOB_OPTIONS,
  QUEUE_LISTING_SYNC,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type {
  ListingSyncBatchJobData,
  ListingSyncPriceJobData,
  ListingSyncPushProductJobData,
  ListingSyncStockJobData,
} from '../queue/queue.types';
import type {
  DeltaSyncResult,
  QueueDepthStatus,
  SyncResult,
} from './listing-sync.types';

@Injectable()
export class ListingSyncService {
  private readonly logger = new Logger(ListingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue<
      | ListingSyncPushProductJobData
      | ListingSyncStockJobData
      | ListingSyncPriceJobData
      | ListingSyncBatchJobData
    >,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue,
    private readonly posthog: PostHogService,
  ) {}

  async pushProductToAllPlatforms(
    orgId: string,
    productId: string,
  ): Promise<SyncResult[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { id: true, barcode: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    const connections = await this.getActiveConnections(orgId);
    const listingPlatforms = await this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        OR: [{ productId }, { barcode: product.barcode }],
      },
      select: { platform: true },
      distinct: ['platform'],
    });
    const platformSet = new Set(listingPlatforms.map((l) => l.platform));

    const results: SyncResult[] = [];
    for (const conn of connections) {
      if (!platformSet.has(conn.platform)) {
        continue;
      }
      const result = await this.pushProductToPlatform(
        orgId,
        productId,
        conn.platform,
      );
      results.push(result);
    }
    return results;
  }

  async pushProductToPlatform(
    orgId: string,
    productId: string,
    platform: Marketplace,
  ): Promise<SyncResult> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        organizationId: orgId,
        platform,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!connection) {
      return {
        platform,
        success: false,
        errorMessage: 'Aktif pazaryeri bağlantısı yok',
      };
    }

    try {
      const job = await this.listingSyncQueue.add(
        'push-product',
        { orgId, productId, platform },
        LISTING_SYNC_JOB_OPTIONS,
      );
      this.posthog.groupCapture(orgId, 'products_pushed', {
        platform,
        count: 1,
      });
      return {
        platform,
        success: true,
        jobId: String(job.id),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Kuyruğa eklenemedi';
      this.logger.error('push-product kuyruğa eklenemedi', {
        orgId,
        productId,
        platform,
        error: message,
      });
      return { platform, success: false, errorMessage: message };
    }
  }

  async syncStockToListings(
    orgId: string,
    barcode: string,
    newStock: number,
  ): Promise<void> {
    await this.listingSyncQueue.add(
      'sync-stock',
      { orgId, barcode, stock: newStock },
      LISTING_SYNC_STOCK_JOB_OPTIONS,
    );
  }

  async afterStockUpdate(productId: string, orgId: string): Promise<void> {
    const listings = await this.getActiveListings(productId, orgId);
    if (listings.length === 0) {
      return;
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { barcode: true },
    });
    if (!product) {
      return;
    }

    const stockQty = await this.resolveCentralStock(orgId, product.barcode);
    await this.enqueuePlatformBatchSync(orgId, listings, {
      stock: stockQty,
    });
  }

  async afterPriceChange(productId: string, orgId: string): Promise<void> {
    const listings = await this.getActiveListings(productId, orgId);
    if (listings.length === 0) {
      return;
    }
    await this.enqueuePlatformBatchSync(orgId, listings, {});
  }

  async afterProductUpdate(productId: string, orgId: string): Promise<void> {
    const listings = await this.getActiveListings(productId, orgId);
    if (listings.length === 0) {
      return;
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { barcode: true },
    });
    if (!product) {
      return;
    }

    const stockQty = await this.resolveCentralStock(orgId, product.barcode);
    await this.enqueuePlatformBatchSync(orgId, listings, { stock: stockQty });
  }

  private async getActiveListings(
    productId: string,
    orgId: string,
  ): Promise<
    Array<{
      id: string;
      platform: Marketplace;
      barcode: string;
      salePrice: { toString(): string };
      listPrice: { toString(): string };
      quantity: number;
    }>
  > {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { barcode: true },
    });
    if (!product) {
      return [];
    }

    return this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ productId }, { barcode: product.barcode }],
      },
      select: {
        id: true,
        platform: true,
        barcode: true,
        salePrice: true,
        listPrice: true,
        quantity: true,
      },
    });
  }

  private async enqueuePlatformBatchSync(
    orgId: string,
    listings: Array<{
      id: string;
      platform: Marketplace;
      barcode: string;
      salePrice: { toString(): string };
      listPrice: { toString(): string };
      quantity: number;
    }>,
    overrides: { stock?: number },
  ): Promise<void> {
    const byPlatform = new Map<Marketplace, typeof listings>();
    for (const listing of listings) {
      const rows = byPlatform.get(listing.platform) ?? [];
      rows.push(listing);
      byPlatform.set(listing.platform, rows);
    }

    for (const [platform, rows] of byPlatform) {
      await this.listingSyncQueue.add(
        'sync-batch',
        {
          orgId,
          platform,
          updates: rows.map((listing) => ({
            barcode: listing.barcode,
            listingId: listing.id,
            stock: overrides.stock ?? listing.quantity,
            price: Number(listing.salePrice),
            listPrice: Number(listing.listPrice),
          })),
        },
        LISTING_SYNC_JOB_OPTIONS,
      );
    }
  }

  private async resolveCentralStock(
    orgId: string,
    barcode: string,
  ): Promise<number> {
    const entry = await this.prisma.stockEntry.findFirst({
      where: {
        organizationId: orgId,
        barcode,
        platform: null,
      },
      select: { quantity: true, reservedQty: true },
    });
    if (!entry) {
      return 0;
    }
    return Math.max(0, entry.quantity - entry.reservedQty);
  }

  async syncPriceToListings(
    orgId: string,
    listingIds: string[],
  ): Promise<void> {
    if (listingIds.length === 0) {
      return;
    }
    await this.listingSyncQueue.add(
      'sync-price',
      { orgId, listingIds },
      LISTING_SYNC_JOB_OPTIONS,
    );
  }

  async deltaSync(
    orgId: string,
    platform: Marketplace,
  ): Promise<DeltaSyncResult> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        organizationId: orgId,
        platform,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!connection) {
      return { platform, productsSynced: 0, jobIds: [] };
    }

    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        platform,
        deletedAt: null,
      },
      select: {
        id: true,
        productId: true,
        barcode: true,
        updatedAt: true,
        lastSyncAt: true,
      },
    });

    const changed = listings.filter((l) => {
      if (l.lastSyncAt === null) {
        return true;
      }
      return l.updatedAt.getTime() > l.lastSyncAt.getTime();
    });

    const jobIds: string[] = [];
    const seenProducts = new Set<string>();

    for (const listing of changed) {
      let productId = listing.productId;
      if (!productId) {
        const product = await this.prisma.product.findFirst({
          where: {
            organizationId: orgId,
            barcode: listing.barcode,
            deletedAt: null,
          },
          select: { id: true },
        });
        productId = product?.id ?? null;
      }
      if (!productId || seenProducts.has(productId)) {
        continue;
      }
      seenProducts.add(productId);
      const job = await this.listingSyncQueue.add(
        'push-product',
        { orgId, productId, platform },
        LISTING_SYNC_JOB_OPTIONS,
      );
      jobIds.push(String(job.id));
    }

    if (seenProducts.size > 0) {
      this.posthog.groupCapture(orgId, 'products_pushed', {
        platform,
        count: seenProducts.size,
      });
    }

    return {
      platform,
      productsSynced: seenProducts.size,
      jobIds,
    };
  }

  async syncAllProductsToPlatforms(orgId: string): Promise<{ jobIds: string[] }> {
    const products = await this.prisma.product.findMany({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    const jobIds: string[] = [];
    for (const product of products) {
      const results = await this.pushProductToAllPlatforms(orgId, product.id);
      for (const r of results) {
        if (r.jobId) {
          jobIds.push(r.jobId);
        }
      }
    }
    return { jobIds };
  }

  async syncListing(orgId: string, listingId: string): Promise<{ jobId: string }> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId: orgId, deletedAt: null },
      select: { id: true, productId: true, barcode: true, platform: true },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    let productId = listing.productId;
    if (!productId) {
      const product = await this.prisma.product.findFirst({
        where: {
          organizationId: orgId,
          barcode: listing.barcode,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException('Listeleme için ürün bulunamadı');
      }
      productId = product.id;
    }

    const result = await this.pushProductToPlatform(
      orgId,
      productId,
      listing.platform,
    );
    if (!result.success || !result.jobId) {
      throw new NotFoundException(
        result.errorMessage ?? 'Senkronizasyon kuyruğa alınamadı',
      );
    }
    return { jobId: result.jobId };
  }

  async getQueueDepths(): Promise<QueueDepthStatus[]> {
    const queues: { name: string; queue: Queue }[] = [
      { name: QUEUE_LISTING_SYNC, queue: this.listingSyncQueue },
      { name: QUEUE_MARKETPLACE_PUSH, queue: this.marketplacePushQueue },
    ];
    const results: QueueDepthStatus[] = [];
    for (const { name, queue } of queues) {
      const counts = await queue.getJobCounts();
      results.push({
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      });
    }
    return results;
  }

  private async getActiveConnections(
    orgId: string,
  ): Promise<{ platform: Marketplace }[]> {
    return this.prisma.marketplaceConnection.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      select: { platform: true },
    });
  }
}
