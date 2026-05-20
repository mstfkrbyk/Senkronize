import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, Prisma, type Product, type ProductVariant } from '@prisma/client';
import type { Queue } from 'bull';

import { Cacheable } from '../common/cache/cache.decorator';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { JOB_DEFAULT_OPTIONS, QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';

import {
  CreateProductDto,
  ProductQueryDto,
  SyncAllPlatformsDto,
  UpdateProductDto,
  UpdateProductReorderDto,
} from './product.dto';

function productListCacheKey(
  organizationId: string,
  query: ProductQueryDto,
): string {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const cachePayload = JSON.stringify({
    page,
    limit,
    search: query.search ?? null,
    isActive: query.isActive ?? null,
    category: query.category ?? null,
  });
  return CacheService.key('products', organizationId, cachePayload);
}

const productListSelect = {
  id: true,
  organizationId: true,
  barcode: true,
  sku: true,
  name: true,
  description: true,
  brand: true,
  category: true,
  categoryId: true,
  costPrice: true,
  reorderPoint: true,
  reorderQty: true,
  leadTimeDays: true,
  tags: true,
  imageUrls: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

export type ProductListItem = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}>;

export interface ProductDetailListing {
  id: string;
  platform: Marketplace;
  title: string;
  salePrice: Prisma.Decimal;
  listPrice: Prisma.Decimal;
  quantity: number;
  approved: boolean;
  lastSyncAt: Date | null;
}

export interface ProductDetailStock {
  id: string;
  barcode: string;
  platform: Marketplace | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  reservedQty: number;
  updatedAt: Date;
}

export interface ProductDetailPayload {
  product: Product;
  variants: ProductVariant[];
  listings: ProductDetailListing[];
  stockMovements: ProductDetailStock[];
}

export interface ReorderAlertRow {
  productId: string;
  barcode: string;
  name: string;
  sku: string | null;
  currentStock: number;
  reorderPoint: number;
  shortfall: number;
  reorderQty: number | null;
  leadTimeDays: number | null;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly outboundWebhookService: OutboundWebhookService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  private async resolveCategoryId(
    organizationId: string,
    categoryId: string,
  ): Promise<string> {
    const row = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new BadRequestException('Geçersiz kategori');
    }
    return categoryId;
  }

  @Cacheable(
    (organizationId: string, query: ProductQueryDto) =>
      productListCacheKey(organizationId, query),
    60,
  )
  async findAll(
    organizationId: string,
    query: ProductQueryDto,
  ): Promise<{ items: ProductListItem[]; total: number }> {
    return this.findAllUncached(organizationId, query);
  }

  private async findAllUncached(
    organizationId: string,
    query: ProductQueryDto,
  ): Promise<{ items: ProductListItem[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.category !== undefined && { category: query.category }),
      ...(query.minCostPrice !== undefined || query.maxCostPrice !== undefined
        ? {
            costPrice: {
              ...(query.minCostPrice !== undefined
                ? { gte: query.minCostPrice }
                : {}),
              ...(query.maxCostPrice !== undefined
                ? { lte: query.maxCostPrice }
                : {}),
            },
          }
        : {}),
      ...(query.search && {
        OR: [
          {
            name: {
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
          {
            sku: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(organizationId: string, id: string): Promise<Product> {
    const row = await this.prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    return row;
  }

  async getProductDetail(
    organizationId: string,
    id: string,
  ): Promise<ProductDetailPayload> {
    const row = await this.prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        variants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        listings: {
          where: { deletedAt: null },
          select: {
            id: true,
            platform: true,
            title: true,
            salePrice: true,
            listPrice: true,
            quantity: true,
            approved: true,
            lastSyncAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    const { variants, listings, ...product } = row;

    const stockEntryRows = await this.prisma.stockEntry.findMany({
      where: { organizationId, productId: id },
      select: {
        id: true,
        barcode: true,
        platform: true,
        warehouseId: true,
        quantity: true,
        reservedQty: true,
        updatedAt: true,
        warehouse: { select: { code: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const stockMovements: ProductDetailStock[] = stockEntryRows.map((r) => ({
      id: r.id,
      barcode: r.barcode,
      platform: r.platform,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse.code,
      warehouseName: r.warehouse.name,
      quantity: r.quantity,
      reservedQty: r.reservedQty,
      updatedAt: r.updatedAt,
    }));
    return { product: product as Product, variants, listings, stockMovements };
  }

  async create(organizationId: string, dto: CreateProductDto): Promise<Product> {
    const categoryId =
      dto.categoryId === undefined
        ? undefined
        : await this.resolveCategoryId(organizationId, dto.categoryId);
    try {
      const created = await this.prisma.product.create({
        data: {
          organizationId,
          name: dto.name,
          barcode: dto.barcode,
          sku: dto.sku,
          brand: dto.brand,
          category: dto.category,
          ...(categoryId !== undefined && { categoryId }),
          description: dto.description,
          costPrice:
            dto.costPrice !== undefined
              ? new Prisma.Decimal(dto.costPrice)
              : null,
          tags: dto.tags ?? [],
          imageUrls: [],
        },
      });
      await this.cache.invalidateProductsForOrg(organizationId);
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu barkod bu organizasyonda zaten kayıtlı.',
        );
      }
      throw error;
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    await this.findOne(organizationId, id);
    let categoryId: string | undefined;
    if (dto.categoryId !== undefined) {
      categoryId = await this.resolveCategoryId(organizationId, dto.categoryId);
    }
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.barcode !== undefined && { barcode: dto.barcode }),
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.brand !== undefined && { brand: dto.brand }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(categoryId !== undefined && { categoryId }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.costPrice !== undefined && {
            costPrice: new Prisma.Decimal(dto.costPrice),
          }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.reorderPoint !== undefined && {
            reorderPoint: dto.reorderPoint,
          }),
          ...(dto.reorderQty !== undefined && { reorderQty: dto.reorderQty }),
          ...(dto.leadTimeDays !== undefined && {
            leadTimeDays: dto.leadTimeDays,
          }),
        },
      });
      await this.cache.invalidateProductsForOrg(organizationId);
      void this.outboundWebhookService.dispatch(organizationId, 'product.updated', {
        productId: id,
      });
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu barkod bu organizasyonda zaten kayıtlı.',
        );
      }
      throw error;
    }
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.$transaction([
      this.prisma.productVariant.updateMany({
        where: { organizationId, productId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);
    await this.cache.invalidateProductsForOrg(organizationId);
  }

  async addImageUrl(
    organizationId: string,
    productId: string,
    imageUrl: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
    });
    if (!product) {
      return;
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrls: { push: imageUrl } },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
  }

  async getByBarcode(
    organizationId: string,
    barcode: string,
  ): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { organizationId, barcode, deletedAt: null },
    });
  }

  async listBarcodes(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      select: { barcode: true },
      orderBy: { barcode: 'asc' },
    });
    return rows.map((r) => r.barcode);
  }

  async syncToPlatforms(
    organizationId: string,
    dto: SyncAllPlatformsDto,
  ): Promise<{ queued: number }> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });

    if (connections.length === 0) {
      return { queued: 0 };
    }

    const payloads: { barcode: string; quantity: number; price?: number }[] = [];

    if (dto.listingIds && dto.listingIds.length > 0) {
      const rows = await this.prisma.listing.findMany({
        where: {
          organizationId,
          deletedAt: null,
          id: { in: dto.listingIds },
        },
        select: { barcode: true, quantity: true },
      });
      const seen = new Set<string>();
      for (const r of rows) {
        if (seen.has(r.barcode)) {
          continue;
        }
        seen.add(r.barcode);
        payloads.push({
          barcode: r.barcode,
          quantity: r.quantity,
          ...(dto.price !== undefined ? { price: dto.price } : {}),
        });
      }
    } else {
      if (!dto.barcode || dto.quantity === undefined) {
        throw new BadRequestException('Barkod ve miktar gerekli');
      }
      payloads.push({
        barcode: dto.barcode,
        quantity: dto.quantity,
        ...(dto.price !== undefined ? { price: dto.price } : {}),
      });
    }

    let queued = 0;
    for (const p of payloads) {
      for (const conn of connections) {
        await this.marketplacePushQueue.add(
          'push-stock',
          {
            organizationId,
            platform: conn.platform,
            type: 'stock',
            resourceIds: [p.barcode],
            payload: {
              updates: [{ barcode: p.barcode, quantity: p.quantity }],
            },
          },
          JOB_DEFAULT_OPTIONS,
        );

        if (p.price !== undefined) {
          await this.marketplacePushQueue.add(
            'push-price',
            {
              organizationId,
              platform: conn.platform,
              type: 'price',
              resourceIds: [p.barcode],
              payload: { price: p.price },
            },
            JOB_DEFAULT_OPTIONS,
          );
        }
        queued += 1;
      }
    }

    return { queued };
  }

  private async aggregateAvailableStockByBarcode(
    organizationId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.stockEntry.groupBy({
      by: ['barcode'],
      where: { organizationId },
      _sum: { quantity: true, reservedQty: true },
    });
    const map = new Map<string, number>();
    for (const r of rows) {
      const q = r._sum.quantity ?? 0;
      const res = r._sum.reservedQty ?? 0;
      map.set(r.barcode, Math.max(0, q - res));
    }
    return map;
  }

  async getReorderAlerts(organizationId: string): Promise<ReorderAlertRow[]> {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        reorderPoint: { not: null },
      },
      select: {
        id: true,
        barcode: true,
        name: true,
        sku: true,
        reorderPoint: true,
        reorderQty: true,
        leadTimeDays: true,
      },
    });
    const stockMap = await this.aggregateAvailableStockByBarcode(organizationId);
    const out: ReorderAlertRow[] = [];
    for (const p of products) {
      const min = p.reorderPoint ?? 0;
      const stock = stockMap.get(p.barcode) ?? 0;
      if (stock >= min) {
        continue;
      }
      out.push({
        productId: p.id,
        barcode: p.barcode,
        name: p.name,
        sku: p.sku,
        currentStock: stock,
        reorderPoint: min,
        shortfall: min - stock,
        reorderQty: p.reorderQty,
        leadTimeDays: p.leadTimeDays,
      });
    }
    out.sort((a, b) => b.shortfall - a.shortfall);
    return out;
  }

  async patchReorderSettings(
    organizationId: string,
    productId: string,
    dto: UpdateProductReorderDto,
  ): Promise<Product> {
    await this.findOne(organizationId, productId);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.reorderPoint !== undefined) {
      data.reorderPoint = dto.reorderPoint;
    }
    if (dto.reorderQty !== undefined) {
      data.reorderQty = dto.reorderQty;
    }
    if (dto.leadTimeDays !== undefined) {
      data.leadTimeDays = dto.leadTimeDays;
    }
    if (Object.keys(data).length === 0) {
      return this.findOne(organizationId, productId);
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data,
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return updated;
  }

  async setReorderPoint(
    organizationId: string,
    barcode: string,
    reorderPoint: number | null,
    reorderQty: number | null,
    leadTimeDays: number | null,
  ): Promise<Product> {
    const row = await this.prisma.product.findFirst({
      where: { organizationId, barcode, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    const updated = await this.prisma.product.update({
      where: { id: row.id },
      data: {
        reorderPoint,
        reorderQty,
        leadTimeDays,
      },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return updated;
  }
}
