import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateProductDto, ProductQueryDto, UpdateProductDto } from './product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll(
    organizationId: string,
    query: ProductQueryDto,
  ): Promise<{ items: Product[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const cachePayload = JSON.stringify({
      page,
      limit,
      search: query.search ?? null,
      isActive: query.isActive ?? null,
      category: query.category ?? null,
    });
    const cacheKey = CacheService.key(
      'products',
      organizationId,
      cachePayload,
    );
    const cached = await this.cache.get<{ items: Product[]; total: number }>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const where: Prisma.ProductWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.category !== undefined && { category: query.category }),
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
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = { items, total };
    await this.cache.set(cacheKey, result, 120);
    return result;
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

  async create(organizationId: string, dto: CreateProductDto): Promise<Product> {
    try {
      const created = await this.prisma.product.create({
        data: {
          organizationId,
          name: dto.name,
          barcode: dto.barcode,
          sku: dto.sku,
          brand: dto.brand,
          category: dto.category,
          description: dto.description,
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
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.barcode !== undefined && { barcode: dto.barcode }),
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.brand !== undefined && { brand: dto.brand }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.description !== undefined && { description: dto.description }),
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
          'Bu barkod bu organizasyonda zaten kayıtlı.',
        );
      }
      throw error;
    }
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
}
