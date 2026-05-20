import { Injectable, BadRequestException } from '@nestjs/common';
import { Marketplace, Prisma } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  BulkCategoryAssignDto,
  BulkPlatformSyncDto,
  BulkPriceUpdateDto,
  BulkStockUpdateDto,
} from './product-bulk.dto';
import { ProductService } from './product.service';

function applyPriceChange(
  current: number,
  updateType: BulkPriceUpdateDto['updateType'],
  value: number,
  direction: BulkPriceUpdateDto['direction'] = 'increase',
): number {
  if (updateType === 'set') {
    return Math.max(0.01, value);
  }
  const sign = direction === 'decrease' ? -1 : 1;
  if (updateType === 'fixed') {
    return Math.max(0.01, current + sign * value);
  }
  return Math.max(0.01, current * (1 + (sign * value) / 100));
}

@Injectable()
export class ProductBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly cache: CacheService,
  ) {}

  async bulkUpdatePrices(
    organizationId: string,
    dto: BulkPriceUpdateDto,
  ): Promise<{ updated: number; previewCount: number }> {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        id: { in: dto.productIds },
      },
      select: { id: true, barcode: true },
    });

    const barcodes = products.map((p) => p.barcode);
    if (barcodes.length === 0) {
      return { updated: 0, previewCount: 0 };
    }

    const listingWhere: Prisma.ListingWhereInput = {
      organizationId,
      deletedAt: null,
      barcode: { in: barcodes },
      ...(dto.platforms?.length ? { platform: { in: dto.platforms } } : {}),
    };

    const listings = await this.prisma.listing.findMany({
      where: listingWhere,
      select: { id: true, salePrice: true, listPrice: true },
    });

    let updated = 0;
    for (const row of listings) {
      const sale = Number(row.salePrice);
      const list = Number(row.listPrice);
      const data: Prisma.ListingUpdateInput = {};
      if (dto.applyToField === 'salePrice' || dto.applyToField === 'both') {
        data.salePrice = new Prisma.Decimal(
          applyPriceChange(sale, dto.updateType, dto.value, dto.direction),
        );
      }
      if (dto.applyToField === 'listPrice' || dto.applyToField === 'both') {
        data.listPrice = new Prisma.Decimal(
          applyPriceChange(list, dto.updateType, dto.value, dto.direction),
        );
      }
      await this.prisma.listing.update({
        where: { id: row.id },
        data,
      });
      updated += 1;
    }

    await this.cache.invalidateListingsForOrg(organizationId);
    await this.cache.invalidateProductsForOrg(organizationId);
    return { updated, previewCount: listings.length };
  }

  async bulkUpdateStock(
    organizationId: string,
    dto: BulkStockUpdateDto,
  ): Promise<{ updated: number }> {
    const result = await this.prisma.productVariant.updateMany({
      where: {
        organizationId,
        deletedAt: null,
        productId: { in: dto.productIds },
      },
      data: { stock: dto.stock },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return { updated: result.count };
  }

  async bulkAssignCategory(
    organizationId: string,
    dto: BulkCategoryAssignDto,
  ): Promise<{ updated: number }> {
    if (!dto.category && !dto.categoryId) {
      throw new BadRequestException('category veya categoryId gerekli');
    }
    const data: { category?: string; categoryId?: string } = {};
    if (dto.category) {
      data.category = dto.category;
    }
    if (dto.categoryId) {
      const row = await this.prisma.productCategory.findFirst({
        where: { id: dto.categoryId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!row) {
        throw new BadRequestException('Geçersiz kategori');
      }
      data.categoryId = dto.categoryId;
    }
    const result = await this.prisma.product.updateMany({
      where: {
        organizationId,
        deletedAt: null,
        id: { in: dto.productIds },
      },
      data,
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return { updated: result.count };
  }

  async bulkDelete(
    organizationId: string,
    productIds: string[],
  ): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const id of productIds) {
      try {
        await this.productService.softDelete(organizationId, id);
        deleted += 1;
      } catch {
        // ürün bulunamadı — atla
      }
    }
    return { deleted };
  }

  async bulkSyncPlatforms(
    organizationId: string,
    dto: BulkPlatformSyncDto,
  ): Promise<{ queued: number }> {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        id: { in: dto.productIds },
      },
      select: { barcode: true },
    });
    const barcodes = products.map((p) => p.barcode);
    if (barcodes.length === 0) {
      return { queued: 0 };
    }

    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        barcode: { in: barcodes },
        platform: { in: dto.platforms as Marketplace[] },
      },
      select: { id: true },
    });

    if (listings.length === 0) {
      return { queued: 0 };
    }

    return this.productService.syncToPlatforms(organizationId, {
      listingIds: listings.map((l) => l.id),
      barcode: barcodes[0] ?? '',
      quantity: 0,
    });
  }
}
