import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProductVariant } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import type { BulkVariantPriceUpdateDto } from './product-bulk.dto';
import type {
  BulkVariantItemDto,
  CreateBulkVariantItemDto,
  CreateVariantDto,
  UpdateVariantDto,
} from './product-variant.dto';

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  return new Prisma.Decimal(value);
}

function toJsonAttributes(
  attributes: Record<string, string>,
): Prisma.InputJsonValue {
  return attributes as Prisma.InputJsonValue;
}

@Injectable()
export class ProductVariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getVariantsByProduct(
    organizationId: string,
    productId: string,
  ): Promise<ProductVariant[]> {
    await this.assertProductInOrg(organizationId, productId);
    return this.prisma.productVariant.findMany({
      where: {
        organizationId,
        productId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createVariant(
    organizationId: string,
    productId: string,
    dto: CreateVariantDto,
  ): Promise<ProductVariant> {
    await this.assertProductInOrg(organizationId, productId);
    try {
      const created = await this.prisma.productVariant.create({
        data: {
          organizationId,
          productId,
          sku: dto.sku,
          barcode: dto.barcode ?? null,
          title: dto.title,
          attributes: toJsonAttributes(dto.attributes),
          price: toDecimal(dto.price ?? null),
          costPrice: toDecimal(dto.costPrice ?? null),
          stock: dto.stock ?? 0,
          imageUrl: dto.imageUrl ?? null,
          isActive: dto.isActive ?? true,
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
          'Bu SKU bu organizasyonda zaten kullanılıyor.',
        );
      }
      throw error;
    }
  }

  async updateVariant(
    organizationId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    const existing = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new NotFoundException('Varyant bulunamadı');
    }
    try {
      const updated = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.barcode !== undefined && { barcode: dto.barcode }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.attributes !== undefined && {
            attributes: toJsonAttributes(dto.attributes),
          }),
          ...(dto.price !== undefined && { price: toDecimal(dto.price) }),
          ...(dto.costPrice !== undefined && {
            costPrice: toDecimal(dto.costPrice),
          }),
          ...(dto.stock !== undefined && { stock: dto.stock }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      await this.cache.invalidateProductsForOrg(organizationId);
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu SKU bu organizasyonda zaten kullanılıyor.',
        );
      }
      throw error;
    }
  }

  async deleteVariant(organizationId: string, variantId: string): Promise<void> {
    const existing = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new NotFoundException('Varyant bulunamadı');
    }
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date() },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
  }

  async bulkUpsertVariants(
    organizationId: string,
    productId: string,
    variants: BulkVariantItemDto[],
  ): Promise<{ created: number; updated: number }> {
    await this.assertProductInOrg(organizationId, productId);
    let created = 0;
    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of variants) {
        const existing = await tx.productVariant.findFirst({
          where: {
            organizationId,
            sku: item.sku,
            deletedAt: null,
          },
        });
        const data = {
          productId,
          barcode: item.barcode ?? null,
          title: item.title,
          attributes: toJsonAttributes(item.attributes),
          price: toDecimal(item.price ?? null),
          costPrice: toDecimal(item.costPrice ?? null),
          stock: item.stock ?? 0,
          imageUrl: item.imageUrl ?? null,
          isActive: item.isActive ?? true,
          deletedAt: null,
        };
        if (existing) {
          if (existing.productId !== productId) {
            throw new ConflictException(
              `SKU "${item.sku}" başka bir ürüne bağlı.`,
            );
          }
          await tx.productVariant.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await tx.productVariant.create({
            data: {
              organizationId,
              ...data,
              sku: item.sku,
            },
          });
          created += 1;
        }
      }
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return { created, updated };
  }

  async bulkUpdateVariantPrices(
    organizationId: string,
    productId: string,
    dto: BulkVariantPriceUpdateDto,
  ): Promise<{ updated: number }> {
    await this.assertProductInOrg(organizationId, productId);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        organizationId,
        productId,
        deletedAt: null,
        ...(dto.variantIds?.length ? { id: { in: dto.variantIds } } : {}),
      },
      select: { id: true, price: true },
    });

    let updated = 0;
    for (const row of variants) {
      const current =
        row.price !== null && row.price !== undefined
          ? Number(row.price)
          : 0;
      const base = current > 0 ? current : 0.01;
      let next = base;
      if (dto.updateType === 'set') {
        next = Math.max(0.01, dto.value);
      } else {
        const sign = dto.direction === 'decrease' ? -1 : 1;
        if (dto.updateType === 'fixed') {
          next = Math.max(0.01, base + sign * dto.value);
        } else {
          next = Math.max(0.01, base * (1 + (sign * dto.value) / 100));
        }
      }
      await this.prisma.productVariant.update({
        where: { id: row.id },
        data: { price: new Prisma.Decimal(next) },
      });
      updated += 1;
    }
    await this.cache.invalidateProductsForOrg(organizationId);
    return { updated };
  }

  async createBulkVariants(
    organizationId: string,
    productId: string,
    items: CreateBulkVariantItemDto[],
  ): Promise<ProductVariant[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      select: { id: true, sku: true, barcode: true, name: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    const baseSku = (product.sku ?? product.barcode ?? '').trim();
    const existingCount = await this.prisma.productVariant.count({
      where: { organizationId, productId, deletedAt: null },
    });

    const created: ProductVariant[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (!item) {
            continue;
          }
          const attributes: Record<string, string> = {
            ...(item.customAttributes ?? {}),
          };
          if (item.color?.trim()) {
            attributes.Renk = item.color.trim();
          }
          if (item.size?.trim()) {
            attributes.Beden = item.size.trim();
          }
          const attrParts = Object.values(attributes).filter(Boolean);
          const title =
            attrParts.length > 0 ? attrParts.join(' / ') : product.name;
          const slug = attrParts
            .map((v) =>
              v
                .toLowerCase()
                .replace(/[^a-z0-9]+/gi, '-')
                .replace(/^-|-$/g, ''),
            )
            .filter(Boolean)
            .join('-');
          const sku =
            item.sku?.trim() ||
            `${baseSku}-${slug || String(existingCount + i + 1)}`;

          const variant = await tx.productVariant.create({
            data: {
              organizationId,
              productId,
              sku,
              barcode: item.barcode?.trim() || null,
              title,
              attributes: toJsonAttributes(attributes),
              price: toDecimal(item.price ?? null),
              stock: item.stock ?? 0,
              isActive: item.isActive ?? true,
            },
          });
          created.push(variant);
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bir veya daha fazla SKU bu organizasyonda zaten kullanılıyor.',
        );
      }
      throw error;
    }

    await this.cache.invalidateProductsForOrg(organizationId);
    return created;
  }

  async bulkAdjustVariantStock(
    organizationId: string,
    productId: string,
    variantIds: string[],
    delta: number,
  ): Promise<{ updated: number }> {
    await this.assertProductInOrg(organizationId, productId);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        organizationId,
        productId,
        deletedAt: null,
        id: { in: variantIds },
      },
      select: { id: true, stock: true },
    });

    let updated = 0;
    for (const row of variants) {
      const next = Math.max(0, row.stock + delta);
      await this.prisma.productVariant.update({
        where: { id: row.id },
        data: { stock: next },
      });
      updated += 1;
    }
    await this.cache.invalidateProductsForOrg(organizationId);
    return { updated };
  }

  async bulkSetVariantActive(
    organizationId: string,
    productId: string,
    variantIds: string[],
    isActive: boolean,
  ): Promise<{ updated: number }> {
    await this.assertProductInOrg(organizationId, productId);
    const result = await this.prisma.productVariant.updateMany({
      where: {
        organizationId,
        productId,
        deletedAt: null,
        id: { in: variantIds },
      },
      data: { isActive },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return { updated: result.count };
  }

  private async assertProductInOrg(
    organizationId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }
  }
}
