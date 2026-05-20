import { createHash } from 'node:crypto';

import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, Prisma, StockMovementType, type Listing } from '@prisma/client';
import type { Queue } from 'bull';
import type { MarketplaceListing } from '@senkronize/shared';

import { readThroughCache, Cacheable } from '../common/cache/cache.decorator';
import { CacheService } from '../common/cache/cache.service';
import { PriceHistoryService } from '../pricing/price-history.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockMovementService } from '../stock/stock-movement.service';
import {
  JOB_DEFAULT_OPTIONS,
  JOB_PULL_ORDERS_OPTIONS,
  QUEUE_MARKETPLACE_PULL,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type {
  MarketplacePullJobData,
  MarketplacePushJobData,
} from '../queue/queue.types';
import { WarehouseService } from '../warehouse/warehouse.service';

import {
  type BulkUpdateItemDto,
  ListingQueryDto,
  ListingSort,
  ListingStatus,
  ListingStockTier,
} from './listing.dto';
import type { BulkResult, ListingSyncError } from './listing.types';

function auditLogMetadata(
  meta: Prisma.JsonValue,
): Record<string, unknown> {
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return {};
  }
  return meta as Record<string, unknown>;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
}

export type ListingListProduct = {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
};

export type SerializedListing = Omit<Listing, 'salePrice' | 'listPrice'> & {
  salePrice: string;
  listPrice: string;
  isActive: boolean;
  status: ListingStatus;
  product?: ListingListProduct | null;
};

export interface ListingSummaryDto {
  total: number;
  byPlatform: Partial<Record<Marketplace, number>>;
  approved: number;
  pending: number;
}

export interface ListingDetailPricePoint {
  appliedAt: string;
  oldPrice: string;
  newPrice: string;
}

export interface ListingDetailBuyBox {
  isWinner: boolean;
  buyBoxPrice: string;
  ourPrice: string;
  capturedAt: string;
}

export interface ListingDetailResponse {
  listing: SerializedListing;
  category: string | null;
  priceHistory: ListingDetailPricePoint[];
  buyBox: ListingDetailBuyBox | null;
  syncErrors: ListingSyncError[];
}

function deriveListingStatus(listing: {
  approved: boolean;
  quantity: number;
  isActive: boolean;
}): ListingStatus {
  if (!listing.isActive) {
    return ListingStatus.INACTIVE;
  }
  if (!listing.approved) {
    return ListingStatus.PENDING;
  }
  if (listing.quantity === 0) {
    return ListingStatus.OUT_OF_STOCK;
  }
  return ListingStatus.ACTIVE;
}

function statusWhere(status: ListingStatus): Prisma.ListingWhereInput {
  switch (status) {
    case ListingStatus.INACTIVE:
      return { isActive: false };
    case ListingStatus.PENDING:
      return { isActive: true, approved: false };
    case ListingStatus.OUT_OF_STOCK:
      return { isActive: true, approved: true, quantity: 0 };
    case ListingStatus.ACTIVE:
      return { isActive: true, approved: true, quantity: { gt: 0 } };
  }
}

function statusUpdateData(status: ListingStatus): Prisma.ListingUpdateInput {
  switch (status) {
    case ListingStatus.INACTIVE:
      return { isActive: false };
    case ListingStatus.PENDING:
      return { approved: false };
    case ListingStatus.OUT_OF_STOCK:
      return { quantity: 0 };
    case ListingStatus.ACTIVE:
      return { isActive: true };
  }
}

function resolveOrderBy(
  sort: ListingSort | undefined,
): Prisma.ListingOrderByWithRelationInput {
  switch (sort) {
    case ListingSort.PRICE_ASC:
      return { salePrice: 'asc' };
    case ListingSort.PRICE_DESC:
      return { salePrice: 'desc' };
    case ListingSort.STOCK_ASC:
      return { quantity: 'asc' };
    case ListingSort.STOCK_DESC:
      return { quantity: 'desc' };
    case ListingSort.UPDATED_DESC:
    default:
      return { updatedAt: 'desc' };
  }
}

const listingFindAllSelect = {
  id: true,
  organizationId: true,
  productId: true,
  platform: true,
  platformProductId: true,
  barcode: true,
  title: true,
  salePrice: true,
  listPrice: true,
  quantity: true,
  approved: true,
  isActive: true,
  imageUrls: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      category: true,
      brand: true,
    },
  },
} satisfies Prisma.ListingSelect;

type ListingFindAllRow = Prisma.ListingGetPayload<{
  select: typeof listingFindAllSelect;
}>;

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly priceHistoryService: PriceHistoryService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
    private readonly warehouseService: WarehouseService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  private serializeListing(
    row: Listing | ListingFindAllRow | (ListingFindAllRow & { product?: ListingListProduct | null }),
  ): SerializedListing {
    const isActive = 'isActive' in row ? row.isActive : true;
    const product =
      'product' in row && row.product != null
        ? {
            id: row.product.id,
            name: row.product.name,
            barcode: row.product.barcode,
            sku: row.product.sku,
            category: row.product.category,
            brand: row.product.brand,
          }
        : undefined;
    const { product: _productJoin, ...listingFields } = row as ListingFindAllRow & {
      product?: ListingListProduct | null;
    };
    return {
      ...listingFields,
      ...(product !== undefined ? { product } : {}),
      salePrice: row.salePrice.toString(),
      listPrice: row.listPrice.toString(),
      isActive,
      status: deriveListingStatus({
        approved: row.approved,
        quantity: row.quantity,
        isActive,
      }),
    };
  }

  private listingFindAllCacheKey(
    organizationId: string,
    query: ListingQueryDto,
  ): string {
    const payload = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      platforms: query.platforms?.length
        ? [...query.platforms].sort().join(',')
        : '',
      platform: query.platform ?? '',
      approved: query.approved ?? '',
      stockTier: query.stockTier ?? '',
      search: query.search ?? '',
      minSalePrice: query.minSalePrice ?? query.priceMin ?? '',
      maxSalePrice: query.maxSalePrice ?? query.priceMax ?? '',
      stockMin: query.stockMin ?? '',
      stockMax: query.stockMax ?? '',
      status: query.status ?? '',
      sort: query.sort ?? '',
      lastSyncAtSince: query.lastSyncAtSince ?? '',
      lastSyncAtUntil: query.lastSyncAtUntil ?? '',
      category: query.category ?? '',
    };
    const digest = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 24);
    return CacheService.key('listings', organizationId, digest);
  }

  async findAll(
    organizationId: string,
    query: ListingQueryDto,
  ): Promise<{ items: SerializedListing[]; total: number }> {
    const cacheKey = this.listingFindAllCacheKey(organizationId, query);
    return readThroughCache(this.cache, cacheKey, 300, async () =>
      this.findAllUncached(organizationId, query),
    );
  }

  private async findAllUncached(
    organizationId: string,
    query: ListingQueryDto,
  ): Promise<{ items: SerializedListing[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const platformWhere: Prisma.ListingWhereInput =
      query.platforms && query.platforms.length > 0
        ? { platform: { in: query.platforms } }
        : query.platform !== undefined
          ? { platform: query.platform }
          : {};

    const stockTierWhere: Prisma.ListingWhereInput =
      query.stockTier === ListingStockTier.IN_STOCK
        ? { quantity: { gt: 20 } }
        : query.stockTier === ListingStockTier.LOW
          ? { quantity: { gte: 1, lte: 20 } }
          : query.stockTier === ListingStockTier.OUT
            ? { quantity: 0 }
            : {};

    const minPrice = query.minSalePrice ?? query.priceMin;
    const maxPrice = query.maxSalePrice ?? query.priceMax;

    const salePriceWhere: Prisma.ListingWhereInput =
      minPrice !== undefined || maxPrice !== undefined
        ? {
            salePrice: {
              ...(minPrice !== undefined && {
                gte: new Prisma.Decimal(minPrice),
              }),
              ...(maxPrice !== undefined && {
                lte: new Prisma.Decimal(maxPrice),
              }),
            },
          }
        : {};

    const stockWhere: Prisma.ListingWhereInput =
      query.stockMin !== undefined || query.stockMax !== undefined
        ? {
            quantity: {
              ...(query.stockMin !== undefined && { gte: query.stockMin }),
              ...(query.stockMax !== undefined && { lte: query.stockMax }),
            },
          }
        : {};

    const statusFilter: Prisma.ListingWhereInput =
      query.status !== undefined ? statusWhere(query.status) : {};

    const lastSyncAtFilter: Prisma.DateTimeFilter = {};
    if (query.lastSyncAtSince !== undefined && query.lastSyncAtSince.trim().length > 0) {
      lastSyncAtFilter.gte = new Date(query.lastSyncAtSince);
    }
    if (query.lastSyncAtUntil !== undefined && query.lastSyncAtUntil.trim().length > 0) {
      const u = new Date(query.lastSyncAtUntil);
      u.setHours(23, 59, 59, 999);
      lastSyncAtFilter.lte = u;
    }
    const lastSyncWhere: Prisma.ListingWhereInput =
      Object.keys(lastSyncAtFilter).length > 0 ? { lastSyncAt: lastSyncAtFilter } : {};

    const categoryWhere: Prisma.ListingWhereInput =
      query.category !== undefined && query.category.trim().length > 0
        ? {
            product: {
              is: {
                deletedAt: null,
                category: {
                  contains: query.category.trim(),
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          }
        : {};

    const where: Prisma.ListingWhereInput = {
      organizationId,
      deletedAt: null,
      ...platformWhere,
      ...(query.approved !== undefined && { approved: query.approved }),
      ...stockTierWhere,
      ...salePriceWhere,
      ...stockWhere,
      ...statusFilter,
      ...lastSyncWhere,
      ...categoryWhere,
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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        select: listingFindAllSelect,
        orderBy: resolveOrderBy(query.sort),
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

  @Cacheable(
    (organizationId: string) =>
      CacheService.key('listings', organizationId, 'summary'),
    30,
  )
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

  async softDelete(organizationId: string, id: string): Promise<void> {
    const row = await this.prisma.listing.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    await this.prisma.listing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.cache.invalidateListingsForOrg(organizationId);
  }

  async getListingDetail(
    organizationId: string,
    id: string,
  ): Promise<ListingDetailResponse> {
    const row = await this.prisma.listing.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        product: { select: { category: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    const { product, ...listingRow } = row;
    const listing = this.serializeListing(listingRow);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [historyRows, snap, syncErrorLogs] = await Promise.all([
      this.prisma.priceHistory.findMany({
        where: {
          organizationId,
          barcode: row.barcode,
          platform: row.platform,
          appliedAt: { gte: since },
        },
        orderBy: { appliedAt: 'desc' },
        take: 60,
        select: { appliedAt: true, oldPrice: true, newPrice: true },
      }),
      this.prisma.buyBoxSnapshot.findFirst({
        where: {
          organizationId,
          barcode: row.barcode,
          platform: row.platform,
        },
        orderBy: { capturedAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          actorOrgId: organizationId,
          action: 'queue.job_failed',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    const priceHistory: ListingDetailPricePoint[] = historyRows.map((h) => ({
      appliedAt: h.appliedAt.toISOString(),
      oldPrice: h.oldPrice.toString(),
      newPrice: h.newPrice.toString(),
    }));

    let buyBox: ListingDetailBuyBox | null = null;
    if (snap) {
      buyBox = {
        isWinner: snap.isWinner,
        buyBoxPrice: snap.buyBoxPrice.toString(),
        ourPrice: snap.ourPrice.toString(),
        capturedAt: snap.capturedAt.toISOString(),
      };
    }

    const syncErrors: ListingSyncError[] = syncErrorLogs
      .filter((log) => {
        const meta = auditLogMetadata(log.metadata);
        const platformRaw = meta.platform;
        if (platformRaw !== row.platform) {
          return false;
        }
        const resourceIds = normalizeStringArray(meta.resourceIds);
        if (resourceIds.includes(row.barcode)) {
          return true;
        }
        const barcodeMeta = meta.barcode;
        return typeof barcodeMeta === 'string' && barcodeMeta === row.barcode;
      })
      .slice(0, 10)
      .map((log) => {
        const meta = auditLogMetadata(log.metadata);
        const message =
          typeof meta.errorMessage === 'string'
            ? meta.errorMessage
            : typeof meta.message === 'string'
              ? meta.message
              : 'Senkronizasyon hatası';
        return {
          id: log.id,
          action: log.action,
          message,
          createdAt: log.createdAt.toISOString(),
        };
      });

    return {
      listing,
      category: product?.category ?? null,
      priceHistory,
      buyBox,
      syncErrors,
    };
  }

  async upsertFromPlatform(
    organizationId: string,
    platform: Marketplace,
    listings: MarketplaceListing[],
  ): Promise<void> {
    const chunkSize = 15;
    for (let i = 0; i < listings.length; i += chunkSize) {
      const chunk = listings.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (l) => {
          const existing = await this.prisma.listing.findFirst({
            where: {
              organizationId,
              platform,
              platformProductId: l.platformProductId,
              deletedAt: null,
            },
          });

          const row = await this.prisma.listing.upsert({
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

          if (existing != null) {
            await this.priceHistoryService.recordPriceChange({
              organizationId,
              listingId: row.id,
              barcode: l.barcode,
              platform,
              oldPrice: existing.salePrice,
              newPrice: l.salePrice,
              source: 'sync',
              reason: 'sync',
            });
          }
        }),
      );
    }
    if (listings.length > 0) {
      await this.cache.invalidateListingsForOrg(organizationId);
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
    await this.cache.invalidateListingsForOrg(organizationId);
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
        JOB_DEFAULT_OPTIONS,
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
      JOB_DEFAULT_OPTIONS,
    );
    await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        salePrice: new Prisma.Decimal(salePrice),
        listPrice: new Prisma.Decimal(listPrice),
      },
    });
    await this.cache.invalidateListingsForOrg(organizationId);
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
      JOB_DEFAULT_OPTIONS,
    );
    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(
      organizationId,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listing.id },
        data: { quantity },
      });
      const existing = await tx.stockEntry.findUnique({
        where: {
          organizationId_barcode_platform_warehouseId: {
            organizationId,
            barcode: listing.barcode,
            platform: listing.platform,
            warehouseId: mainWh.id,
          },
        },
      });
      const before = existing?.quantity ?? 0;
      await tx.stockEntry.upsert({
        where: {
          organizationId_barcode_platform_warehouseId: {
            organizationId,
            barcode: listing.barcode,
            platform: listing.platform,
            warehouseId: mainWh.id,
          },
        },
        create: {
          organizationId,
          warehouseId: mainWh.id,
          barcode: listing.barcode,
          platform: listing.platform,
          quantity,
        },
        update: { quantity },
      });
      const after = quantity;
      if (before !== after) {
        await this.stockMovementService.record({
          organizationId,
          barcode: listing.barcode,
          warehouseId: mainWh.id,
          platform: String(listing.platform),
          movementType: StockMovementType.SYNC,
          quantity: after - before,
          beforeQuantity: before,
          afterQuantity: after,
          note: 'Listeleme stok güncellemesi',
          tx,
        });
      }
    });
    await Promise.all([
      this.cache.invalidateListingsForOrg(organizationId),
      this.cache.invalidateStockForOrg(organizationId),
      this.cache.invalidateProductsForOrg(organizationId),
    ]);
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
    await this.cache.invalidateListingsForOrg(organizationId);
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
    if (updated > 0) {
      await this.cache.invalidateListingsForOrg(organizationId);
    }
    return { updated };
  }

  async bulkUpdateStatus(
    organizationId: string,
    listingIds: string[],
    status: ListingStatus,
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };
    const data = statusUpdateData(status);

    for (const id of listingIds) {
      try {
        const row = await this.prisma.listing.findFirst({
          where: { id, organizationId, deletedAt: null },
        });
        if (!row) {
          result.failed += 1;
          result.errors.push({ id, message: 'Listeleme bulunamadı' });
          continue;
        }
        await this.prisma.listing.update({
          where: { id },
          data,
        });
        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id, message: 'Güncelleme başarısız' });
      }
    }

    if (result.success > 0) {
      await this.cache.invalidateListingsForOrg(organizationId);
    }
    return result;
  }

  async bulkUpdatePrice(
    organizationId: string,
    updates: { id: string; price: number }[],
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const item of updates) {
      try {
        const row = await this.prisma.listing.findFirst({
          where: { id: item.id, organizationId, deletedAt: null },
        });
        if (!row) {
          result.failed += 1;
          result.errors.push({ id: item.id, message: 'Listeleme bulunamadı' });
          continue;
        }
        const listPrice = Math.max(Number(row.listPrice), item.price);
        await this.updatePrice(
          organizationId,
          item.id,
          item.price,
          listPrice,
        );
        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id: item.id, message: 'Fiyat güncellenemedi' });
      }
    }

    return result;
  }

  async bulkUpdateStock(
    organizationId: string,
    updates: { id: string; stock: number }[],
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const item of updates) {
      try {
        const row = await this.prisma.listing.findFirst({
          where: { id: item.id, organizationId, deletedAt: null },
        });
        if (!row) {
          result.failed += 1;
          result.errors.push({ id: item.id, message: 'Listeleme bulunamadı' });
          continue;
        }
        await this.updateStock(organizationId, item.id, item.stock);
        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id: item.id, message: 'Stok güncellenemedi' });
      }
    }

    return result;
  }

  async bulkPushToPlatform(
    organizationId: string,
    listingIds: string[],
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const id of listingIds) {
      try {
        const row = await this.prisma.listing.findFirst({
          where: { id, organizationId, deletedAt: null },
        });
        if (!row) {
          result.failed += 1;
          result.errors.push({ id, message: 'Listeleme bulunamadı' });
          continue;
        }
        await this.marketplacePushQueue.add(
          'push-price',
          {
            organizationId,
            platform: row.platform,
            type: 'price',
            resourceIds: [row.barcode],
            payload: {
              salePrice: Number(row.salePrice),
              listPrice: Number(row.listPrice),
            },
          },
          JOB_DEFAULT_OPTIONS,
        );
        await this.marketplacePushQueue.add(
          'push-stock',
          {
            organizationId,
            platform: row.platform,
            type: 'stock',
            resourceIds: [row.barcode],
            payload: { quantity: row.quantity },
          },
          JOB_DEFAULT_OPTIONS,
        );
        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id, message: 'Platforma gönderilemedi' });
      }
    }

    return result;
  }

  async toggleListingActive(
    organizationId: string,
    listingId: string,
  ): Promise<SerializedListing> {
    const row = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { isActive: !row.isActive },
    });
    await this.cache.invalidateListingsForOrg(organizationId);
    return this.serializeListing(updated);
  }

  async syncListing(
    organizationId: string,
    listingId: string,
  ): Promise<{ jobIds: string[] }> {
    const row = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const jobIds: string[] = [];
    const pullJob = await this.marketplacePullQueue.add(
      'pull-listings',
      {
        organizationId,
        platform: row.platform,
        type: 'listings',
      },
      JOB_DEFAULT_OPTIONS,
    );
    jobIds.push(String(pullJob.id));

    const pushResult = await this.bulkPushToPlatform(organizationId, [
      listingId,
    ]);
    if (pushResult.failed > 0) {
      throw new BadRequestException('Platforma gönderim kuyruğa alınamadı');
    }

    return { jobIds };
  }

  async retryFromAuditLog(
    organizationId: string,
    auditLogId: string,
  ): Promise<{ jobId: string }> {
    const log = await this.prisma.auditLog.findFirst({
      where: {
        id: auditLogId,
        OR: [
          { actorOrgId: organizationId },
          { impersonatedOrgId: organizationId },
        ],
        action: 'queue.job_failed',
      },
    });
    if (!log) {
      throw new NotFoundException('Kayıt bulunamadı veya yeniden denenemez');
    }
    const meta = auditLogMetadata(log.metadata);
    const metaOrgId = meta.organizationId;
    if (typeof metaOrgId !== 'string' || metaOrgId !== organizationId) {
      throw new ForbiddenException('Bu kayıt için yetkiniz yok');
    }
    const jobName = typeof meta.jobName === 'string' ? meta.jobName : '';
    const platformRaw = typeof meta.platform === 'string' ? meta.platform : '';
    const marketplaceValues = Object.values(Marketplace) as string[];
    if (!platformRaw || !marketplaceValues.includes(platformRaw)) {
      throw new BadRequestException('Kayıtta platform bilgisi eksik veya geçersiz');
    }
    const platform = platformRaw as Marketplace;

    if (jobName === 'pull-listings') {
      const job = await this.marketplacePullQueue.add(
        'pull-listings',
        { organizationId, platform, type: 'listings' },
        JOB_DEFAULT_OPTIONS,
      );
      return { jobId: String(job.id) };
    }
    if (jobName === 'pull-orders') {
      const since = typeof meta.since === 'string' ? meta.since : undefined;
      const job = await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform,
          type: 'orders',
          ...(since ? { since } : {}),
        },
        JOB_PULL_ORDERS_OPTIONS,
      );
      return { jobId: String(job.id) };
    }
    if (jobName === 'push-stock') {
      const resourceIds = normalizeStringArray(meta.resourceIds);
      if (resourceIds.length === 0) {
        throw new BadRequestException('Yeniden deneme için barkod listesi eksik');
      }
      const payload =
        meta.payload != null &&
        typeof meta.payload === 'object' &&
        !Array.isArray(meta.payload)
          ? (meta.payload as Record<string, unknown>)
          : undefined;
      const job = await this.marketplacePushQueue.add(
        'push-stock',
        {
          organizationId,
          platform,
          type: 'stock',
          resourceIds,
          payload,
        },
        JOB_DEFAULT_OPTIONS,
      );
      return { jobId: String(job.id) };
    }
    if (jobName === 'push-price') {
      const resourceIds = normalizeStringArray(meta.resourceIds);
      if (resourceIds.length === 0) {
        throw new BadRequestException('Yeniden deneme için barkod listesi eksik');
      }
      const payload =
        meta.payload != null &&
        typeof meta.payload === 'object' &&
        !Array.isArray(meta.payload)
          ? (meta.payload as Record<string, unknown>)
          : undefined;
      const job = await this.marketplacePushQueue.add(
        'push-price',
        {
          organizationId,
          platform,
          type: 'price',
          resourceIds,
          payload,
        },
        JOB_DEFAULT_OPTIONS,
      );
      return { jobId: String(job.id) };
    }

    throw new BadRequestException(
      'Bu iş türü için otomatik yeniden deneme desteklenmiyor',
    );
  }
}
