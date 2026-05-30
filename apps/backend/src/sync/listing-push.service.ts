import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Queue } from 'bull';

import {
  buildListingOrForProduct,
  resolveProductStockKey,
} from '../common/product-match-key';
import { PrismaService } from '../prisma/prisma.service';
import {
  LISTING_SYNC_JOB_OPTIONS,
  QUEUE_LISTING_SYNC,
} from '../queue/queue.constants';
import type { ListingSyncBatchJobData } from '../queue/queue.types';

import {
  isPricePushEnabled,
  isStockPushEnabled,
  type ConnectionPushSettings,
  type ProductPushSettings,
} from './listing-push-policy.util';

export interface ListingPushRow {
  id: string;
  platform: Marketplace;
  barcode: string;
  platformProductId: string;
  productId: string | null;
  salePrice: { toString(): string };
  listPrice: { toString(): string };
  quantity: number;
  product: ProductPushSettings | null;
}

@Injectable()
export class ListingPushService {
  private readonly logger = new Logger(ListingPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue<ListingSyncBatchJobData>,
  ) {}

  async findListingsForBarcode(
    organizationId: string,
    barcode: string,
  ): Promise<ListingPushRow[]> {
    const trimmed = barcode.trim();
    if (!trimmed) {
      return [];
    }

    const product = await this.prisma.product.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [{ barcode: trimmed }, { sku: trimmed }],
      },
      select: {
        id: true,
        barcode: true,
        sku: true,
        pushStockEnabled: true,
        pushPriceEnabled: true,
      },
    });

    const listingOr: Array<{ productId: string } | { barcode: string }> = [
      { barcode: trimmed },
    ];
    if (product) {
      listingOr.push(...buildListingOrForProduct(product.id, product));
    }

    return this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        OR: listingOr,
      },
      select: {
        id: true,
        platform: true,
        barcode: true,
        platformProductId: true,
        productId: true,
        salePrice: true,
        listPrice: true,
        quantity: true,
        product: {
          select: {
            pushStockEnabled: true,
            pushPriceEnabled: true,
          },
        },
      },
    });
  }

  async buildStockPushBatches(
    organizationId: string,
    stockByBarcode: ReadonlyMap<string, number>,
  ): Promise<Map<Marketplace, ListingSyncBatchJobData['updates']>> {
    if (stockByBarcode.size === 0) {
      return new Map();
    }

    const connectionMap = await this.loadConnectionPushSettings(organizationId);
    const updatesByPlatform = new Map<
      Marketplace,
      ListingSyncBatchJobData['updates']
    >();

    for (const [barcode, stock] of stockByBarcode) {
      const listings = await this.findListingsForBarcode(organizationId, barcode);
      for (const listing of listings) {
        const conn = connectionMap.get(listing.platform);
        if (!conn || !isStockPushEnabled(conn, listing.product)) {
          continue;
        }
        const rows = updatesByPlatform.get(listing.platform) ?? [];
        rows.push({
          barcode: listing.barcode,
          listingId: listing.id,
          platformProductId: listing.platformProductId,
          stock,
        });
        updatesByPlatform.set(listing.platform, rows);
      }
    }

    return updatesByPlatform;
  }

  async enqueueStockPushBatch(
    organizationId: string,
    stockByBarcode: ReadonlyMap<string, number>,
  ): Promise<number> {
    const updatesByPlatform = await this.buildStockPushBatches(
      organizationId,
      stockByBarcode,
    );

    let queued = 0;
    for (const [platform, updates] of updatesByPlatform) {
      if (updates.length === 0) {
        continue;
      }
      await this.listingSyncQueue.add(
        'sync-batch',
        { orgId: organizationId, platform, updates },
        LISTING_SYNC_JOB_OPTIONS,
      );
      queued += updates.length;
    }

    if (queued > 0) {
      this.logger.log('Toplu stok push kuyruğa alındı', {
        organizationId,
        barcodes: stockByBarcode.size,
        updates: queued,
      });
    }

    return queued;
  }

  async enqueueStockPushForBarcode(
    organizationId: string,
    barcode: string,
    stock: number,
  ): Promise<number> {
    return this.enqueueStockPushBatch(
      organizationId,
      new Map([[barcode.trim(), stock]]),
    );
  }

  private async loadConnectionPushSettings(
    organizationId: string,
  ): Promise<Map<Marketplace, ConnectionPushSettings>> {
    const rows = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { platform: true, pushStock: true, pushPrice: true },
    });
    return new Map(
      rows.map((row) => [
        row.platform,
        { pushStock: row.pushStock, pushPrice: row.pushPrice },
      ]),
    );
  }
}

export { resolveProductStockKey };
