import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProductVariant } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

export interface VariantMatrixAttribute {
  name: string;
  values: string[];
}

function buildAttributeCombinations(
  attributes: VariantMatrixAttribute[],
): Record<string, string>[] {
  if (attributes.length === 0) {
    return [{}];
  }
  const [head, ...tail] = attributes;
  if (!head || head.values.length === 0) {
    throw new BadRequestException('Her özellik için en az bir değer gerekli');
  }
  const tailCombos = buildAttributeCombinations(tail);
  const result: Record<string, string>[] = [];
  for (const value of head.values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    for (const combo of tailCombos) {
      result.push({ ...combo, [head.name]: trimmed });
    }
  }
  return result;
}

function attributesMatch(
  a: Record<string, string>,
  b: Record<string, unknown>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length === 0) {
    return false;
  }
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (typeof right !== 'string' || right !== left) {
      return false;
    }
  }
  return true;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class VariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async generateVariantMatrix(
    organizationId: string,
    productId: string,
    attributes: VariantMatrixAttribute[],
  ): Promise<ProductVariant[]> {
    if (attributes.length === 0) {
      throw new BadRequestException('En az bir özellik tanımlanmalı');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      select: { id: true, sku: true, barcode: true, name: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    const combinations = buildAttributeCombinations(attributes);
    if (combinations.length === 0) {
      throw new BadRequestException('Geçerli varyant kombinasyonu üretilemedi');
    }

    const existing = await this.prisma.productVariant.findMany({
      where: { organizationId, productId, deletedAt: null },
    });

    const baseSku = (product.sku ?? product.barcode ?? '').trim();
    const created: ProductVariant[] = [];

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const combo of combinations) {
          const duplicate = existing.some((v) =>
            attributesMatch(combo, v.attributes as Record<string, unknown>),
          );
          if (duplicate) {
            continue;
          }

          const titleParts = Object.values(combo);
          const title =
            titleParts.length > 0 ? titleParts.join(' / ') : product.name;
          const slug = titleParts.map(slugify).filter(Boolean).join('-');
          const sku = `${baseSku}-${slug || String(existing.length + created.length + 1)}`;

          const variant = await tx.productVariant.create({
            data: {
              organizationId,
              productId,
              sku,
              title,
              attributes: combo as Prisma.InputJsonValue,
              stock: 0,
              isActive: true,
            },
          });
          created.push(variant);
          existing.push(variant);
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Oluşturulan SKU bu organizasyonda zaten kullanılıyor.',
        );
      }
      throw error;
    }

    if (created.length > 0) {
      await this.cache.invalidateProductsForOrg(organizationId);
    }
    return created;
  }

  async bulkUpdate(
    organizationId: string,
    updates: { id: string; price?: number; stock?: number; sku?: string }[],
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of updates) {
        const row = await tx.productVariant.findFirst({
          where: { id: item.id, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (!row) {
          continue;
        }
        await tx.productVariant.update({
          where: { id: item.id },
          data: {
            ...(item.price !== undefined && {
              price: new Prisma.Decimal(item.price),
            }),
            ...(item.stock !== undefined && { stock: item.stock }),
            ...(item.sku !== undefined && { sku: item.sku }),
          },
        });
      }
    });
    await this.cache.invalidateProductsForOrg(organizationId);
  }

  async assignImages(
    organizationId: string,
    variantId: string,
    imageUrls: string[],
  ): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!variant) {
      throw new NotFoundException('Varyant bulunamadı');
    }
    const primary = imageUrls.find((u) => u.trim().length > 0)?.trim() ?? null;
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { imageUrl: primary },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
  }
}
