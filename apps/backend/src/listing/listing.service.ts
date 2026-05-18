import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Marketplace, Prisma, type Listing } from '@prisma/client';
import type { Queue } from 'bull';
import type { MarketplaceListing } from '@senkronize/shared';

import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_MARKETPLACE_PULL, QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type {
  MarketplacePullJobData,
  MarketplacePushJobData,
} from '../queue/queue.types';

import type { BulkUpdateItemDto, ListingQueryDto } from './listing.dto';

export type SerializedListing = Omit<Listing, 'salePrice' | 'listPrice'> & {
  salePrice: string;
  listPrice: string;
};

export interface ListingSummaryDto {
  total: number;
  byPlatform: Partial<Record<Marketplace, number>>;
  approved: number;
  pending: number;
}

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
  ) {}

  private serializeListing(row: Listing): SerializedListing {
    return {
      ...row,
      salePrice: row.salePrice.toString(),
      listPrice: row.listPrice.toString(),
    };
  }

  async findAll(
    organizationId: string,
    query: ListingQueryDto,
  ): Promise<{ items: SerializedListing[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ListingWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.platform !== undefined && { platform: query.platform }),
      ...(query.approved !== undefined && { approved: query.approved }),
      ...(query.lastSyncAtSince !== undefined &&
        query.lastSyncAtSince.trim().length > 0 && {
          lastSyncAt: { gte: new Date(query.lastSyncAtSince) },
        }),
      ...(query.search && {
        OR: [
          {
            title: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            barcode: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.serializeListing(r)),
      total,
    };
  }

  async getSummary(organizationId: string): Promise<ListingSummaryDto> {
    const base = { organizationId, deletedAt: null } satisfies Prisma.ListingWhereInput;

    const [total, approved, pending, platformGroups] = await Promise.all([
      this.prisma.listing.count({ where: base }),
      this.prisma.listing.count({ where: { ...base, approved: true } }),
      this.prisma.listing.count({ where: { ...base, approved: false } }),
      this.prisma.listing.groupBy({
        by: ['platform'],
        where: base,
        _count: { _all: true },
      }),
    ]);

    const byPlatform: Partial<Record<Marketplace, number>> = {};
    for (const g of platformGroups) {
      byPlatform[g.platform] = g._count._all;
    }

    return { total, byPlatform, approved, pending };
  }

  async findOne(organizationId: string, id: string): Promise<SerializedListing> {
    const row = await this.prisma.listing.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    return this.serializeListing(row);
  }

  async upsertFromPlatform(
    organizationId: string,
    platform: Marketplace,
    listings: MarketplaceListing[],
  ): Promise<void> {
    for (const l of listings) {
      await this.prisma.listing.upsert({
        where: {
          organizationId_platform_platformProductId: {
            organizationId,
            platform,
            platformProductId: l.platformProductId,
          },
        },
        create: {
          organizationId,
          platform,
          platformProductId: l.platformProductId,
          barcode: l.barcode,
          title: l.title,
          salePrice: new Prisma.Decimal(l.salePrice),
          listPrice: new Prisma.Decimal(l.listPrice),
          quantity: l.quantity,
          approved: l.approved,
          imageUrls: l.images,
          lastSyncAt: new Date(),
        },
        update: {
          title: l.title,
          salePrice: new Prisma.Decimal(l.salePrice),
          listPrice: new Prisma.Decimal(l.listPrice),
          quantity: l.quantity,
          approved: l.approved,
          imageUrls: l.images,
          lastSyncAt: new Date(),
        },
      });
    }
  }

  /**
   * Pazaryeri webhook (ör. ürün onayı) ile listeleme onay durumunu günceller.
   */
  async updateApprovalStatusFromWebhook(
    organizationId: string,
    platform: Marketplace,
    opts: {
      approved: boolean;
      platformProductId?: string;
      barcode?: string;
    },
  ): Promise<void> {
    const where: Prisma.ListingWhereInput = {
      organizationId,
      platform,
      deletedAt: null,
    };
    if (opts.platformProductId) {
      where.platformProductId = opts.platformProductId;
    } else if (opts.barcode) {
      where.barcode = opts.barcode;
    } else {
      return;
    }

    await this.prisma.listing.updateMany({
      where,
      data: { approved: opts.approved, lastSyncAt: new Date() },
    });
  }

  async triggerSync(organizationId: string): Promise<{ jobIds: string[] }> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });
    const jobIds: string[] = [];
    for (const conn of connections) {
      const job = await this.marketplacePullQueue.add(
        'pull-listings',
        {
          organizationId,
          platform: conn.platform,
          type: 'listings',
        },
        STANDARD_QUEUE_JOB_OPTIONS,
      );
      jobIds.push(String(job.id));
    }
    return { jobIds };
  }

  async updatePrice(
    organizationId: string,
    id: string,
    salePrice: number,
    listPrice: number,
  ): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    await this.marketplacePushQueue.add(
      'push-price',
      {
        organizationId,
        platform: listing.platform,
        type: 'price',
        resourceIds: [listing.barcode],
        payload: { salePrice, listPrice },
      },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
    await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        salePrice: new Prisma.Decimal(salePrice),
        listPrice: new Prisma.Decimal(listPrice),
      },
    });
  }

  async updateStock(
    organizationId: string,
    id: string,
    quantity: number,
  ): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    await this.marketplacePushQueue.add(
      'push-stock',
      {
        organizationId,
        platform: listing.platform,
        type: 'stock',
        resourceIds: [listing.barcode],
        payload: { quantity },
      },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listing.id },
        data: { quantity },
      });
      await tx.stockEntry.upsert({
        where: {
          organizationId_barcode_platform: {
            organizationId,
            barcode: listing.barcode,
            platform: listing.platform,
          },
        },
        create: {
          organizationId,
          barcode: listing.barcode,
          platform: listing.platform,
          quantity,
        },
        update: { quantity },
      });
    });
  }

  async findListingIdByPlatformProduct(
    organizationId: string,
    platform: Marketplace,
    platformProductId: string,
  ): Promise<string | null> {
    const row = await this.prisma.listing.findFirst({
      where: { organizationId, platform, platformProductId, deletedAt: null },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async addImageUrl(
    organizationId: string,
    listingId: string,
    imageUrl: string,
  ): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      return;
    }
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { imageUrls: { push: imageUrl } },
    });
  }

  async bulkUpdateStockAndPrice(
    organizationId: string,
    items: BulkUpdateItemDto[],
  ): Promise<{ updated: number }> {
    let updated = 0;
    for (const item of items) {
      const hasPatch =
        item.quantity !== undefined ||
        item.salePrice !== undefined ||
        item.listPrice !== undefined;
      if (!hasPatch) {
        continue;
      }

      if (item.listingId) {
        const row = await this.prisma.listing.findFirst({
          where: {
            id: item.listingId,
            organizationId,
            deletedAt: null,
          },
        });
        if (!row) {
          continue;
        }
        if (item.quantity !== undefined) {
          await this.updateStock(organizationId, row.id, item.quantity);
        }
        if (item.salePrice !== undefined || item.listPrice !== undefined) {
          const salePrice =
            item.salePrice !== undefined
              ? item.salePrice
              : Number(row.salePrice);
          const listPrice =
            item.listPrice !== undefined
              ? item.listPrice
              : Number(row.listPrice);
          await this.updatePrice(
            organizationId,
            row.id,
            salePrice,
            listPrice,
          );
        }
        updated++;
        continue;
      }

      if (!item.barcode) {
        continue;
      }

      const rows = await this.prisma.listing.findMany({
        where: {
          organizationId,
          barcode: item.barcode,
          deletedAt: null,
        },
      });
      for (const row of rows) {
        if (item.quantity !== undefined) {
          await this.updateStock(organizationId, row.id, item.quantity);
        }
        if (item.salePrice !== undefined || item.listPrice !== undefined) {
          const salePrice =
            item.salePrice !== undefined
              ? item.salePrice
              : Number(row.salePrice);
          const listPrice =
            item.listPrice !== undefined
              ? item.listPrice
              : Number(row.listPrice);
          await this.updatePrice(
            organizationId,
            row.id,
            salePrice,
            listPrice,
          );
        }
        updated++;
      }
    }
    return { updated };
  }
}
