import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Marketplace, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type {
  CategoryDetailPayload,
  CategoryListRow,
  CategoryProductSummary,
  CategoryTreeNode,
  PlatformMappingRow,
} from './category.types';
import { slugifyCategoryName } from './category.utils';
import type { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUniqueSlug(
    organizationId: string,
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let n = 0;
    for (;;) {
      const found = await this.prisma.productCategory.findFirst({
        where: {
          organizationId,
          slug,
          deletedAt: null,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!found) {
        return slug;
      }
      n += 1;
      slug = `${baseSlug}-${n}`;
    }
  }

  private async computeLevel(
    organizationId: string,
    parentId: string | null,
  ): Promise<number> {
    if (!parentId) {
      return 0;
    }
    const parent = await this.prisma.productCategory.findFirst({
      where: {
        id: parentId,
        organizationId,
        deletedAt: null,
      },
      select: { level: true },
    });
    if (!parent) {
      throw new BadRequestException('Üst kategori bulunamadı');
    }
    return parent.level + 1;
  }

  private async collectDescendantIds(
    organizationId: string,
    rootId: string,
  ): Promise<string[]> {
    const result: string[] = [];
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      result.push(id);
      const children = await this.prisma.productCategory.findMany({
        where: { organizationId, parentId: id, deletedAt: null },
        select: { id: true },
      });
      for (const c of children) {
        queue.push(c.id);
      }
    }
    return result;
  }

  private isDescendant(
    nodeId: string,
    maybeAncestorId: string,
    byParent: Map<string, string | null>,
  ): boolean {
    let cur: string | null = nodeId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === maybeAncestorId) {
        return true;
      }
      if (seen.has(cur)) {
        break;
      }
      seen.add(cur);
      cur = byParent.get(cur) ?? null;
    }
    return false;
  }

  async createCategory(
    organizationId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryListRow> {
    const baseSlug = slugifyCategoryName(dto.name);
    const slug = await this.ensureUniqueSlug(organizationId, baseSlug);
    const level = await this.computeLevel(organizationId, dto.parentId ?? null);
    const sortOrder = dto.sortOrder ?? 0;

    const created = await this.prisma.productCategory.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        slug,
        parentId: dto.parentId ?? null,
        level,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      parentId: created.parentId,
      level: created.level,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async listCategories(organizationId: string): Promise<CategoryListRow[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        level: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows;
  }

  async getCategoryTree(organizationId: string): Promise<CategoryTreeNode[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    const byId = new Map<string, CategoryTreeNode>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        slug: r.slug,
        parentId: r.parentId,
        level: r.level,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
        children: [],
      });
    }

    const roots: CategoryTreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortChildren = (n: CategoryTreeNode): void => {
      n.children.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
      for (const c of n.children) {
        sortChildren(c);
      }
    };
    for (const r of roots) {
      sortChildren(r);
    }
    roots.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));

    return roots;
  }

  async getCategoryDetail(
    organizationId: string,
    id: string,
  ): Promise<CategoryDetailPayload> {
    const cat = await this.prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        platformMappings: {
          select: {
            id: true,
            platform: true,
            platformCategoryId: true,
            platformCategoryName: true,
          },
        },
      },
    });
    if (!cat) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        categoryId: id,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      take: 200,
      select: {
        id: true,
        barcode: true,
        name: true,
        sku: true,
        isActive: true,
      },
    });

    const productSummaries: CategoryProductSummary[] = products.map((p) => ({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      sku: p.sku,
      isActive: p.isActive,
    }));

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      level: cat.level,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      platformMappings: cat.platformMappings,
      products: productSummaries,
    };
  }

  async updateCategory(
    organizationId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryListRow> {
    const existing = await this.prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    let nextSlug = existing.slug;
    if (dto.slug !== undefined) {
      nextSlug = await this.ensureUniqueSlug(
        organizationId,
        slugifyCategoryName(dto.slug),
        id,
      );
    } else if (dto.name !== undefined) {
      nextSlug = await this.ensureUniqueSlug(
        organizationId,
        slugifyCategoryName(dto.name),
        id,
      );
    }

    let parentId = existing.parentId;
    if (dto.parentId !== undefined) {
      parentId = dto.parentId;
    }

    if (parentId === id) {
      throw new BadRequestException('Kategori kendi üst kategorisi olamaz');
    }

    if (parentId) {
      const parent = await this.prisma.productCategory.findFirst({
        where: { id: parentId, organizationId, deletedAt: null },
      });
      if (!parent) {
        throw new BadRequestException('Üst kategori bulunamadı');
      }

      const flat = await this.prisma.productCategory.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      const byParent = new Map(flat.map((f) => [f.id, f.parentId] as const));
      if (this.isDescendant(parentId, id, byParent)) {
        throw new BadRequestException('Döngüsel kategori hiyerarşisi oluşturulamaz');
      }
    }

    const level = await this.computeLevel(organizationId, parentId);

    const data: Prisma.ProductCategoryUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      slug: nextSlug,
      ...(dto.parentId !== undefined && { parentId }),
      level,
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const updated = await this.prisma.productCategory.update({
      where: { id },
      data,
    });

    if (dto.parentId !== undefined || level !== existing.level) {
      await this.recomputeSubtreeLevels(organizationId, id);
    }

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      parentId: updated.parentId,
      level: updated.level,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  private async recomputeSubtreeLevels(
    organizationId: string,
    rootId: string,
  ): Promise<void> {
    const root = await this.prisma.productCategory.findFirst({
      where: { id: rootId, organizationId, deletedAt: null },
      select: { level: true },
    });
    if (!root) {
      return;
    }

    const queue: { id: string; level: number }[] = [{ id: rootId, level: root.level }];
    while (queue.length) {
      const { id, level } = queue.shift()!;
      const children = await this.prisma.productCategory.findMany({
        where: { organizationId, parentId: id, deletedAt: null },
        select: { id: true },
      });
      for (const c of children) {
        const childLevel = level + 1;
        await this.prisma.productCategory.update({
          where: { id: c.id },
          data: { level: childLevel },
        });
        queue.push({ id: c.id, level: childLevel });
      }
    }
  }

  async deleteCategory(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    const ids = await this.collectDescendantIds(organizationId, id);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.product.updateMany({
        where: { organizationId, categoryId: { in: ids } },
        data: { categoryId: null },
      }),
      this.prisma.productCategory.updateMany({
        where: { id: { in: ids }, organizationId },
        data: { deletedAt: now, isActive: false },
      }),
    ]);
  }

  async mapToPlatformCategory(
    organizationId: string,
    internalCategoryId: string,
    platform: Marketplace,
    platformCategoryId: string,
    platformCategoryName: string,
  ): Promise<void> {
    const cat = await this.prisma.productCategory.findFirst({
      where: { id: internalCategoryId, organizationId, deletedAt: null },
    });
    if (!cat) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    await this.prisma.platformCategoryMapping.upsert({
      where: {
        organizationId_internalCategoryId_platform: {
          organizationId,
          internalCategoryId,
          platform,
        },
      },
      create: {
        organizationId,
        internalCategoryId,
        platform,
        platformCategoryId,
        platformCategoryName,
      },
      update: {
        platformCategoryId,
        platformCategoryName,
      },
    });
  }

  async getPlatformMappings(
    organizationId: string,
    platform: Marketplace,
  ): Promise<PlatformMappingRow[]> {
    return this.prisma.platformCategoryMapping.findMany({
      where: { organizationId, platform },
      select: {
        id: true,
        internalCategoryId: true,
        platform: true,
        platformCategoryId: true,
        platformCategoryName: true,
      },
      orderBy: { internalCategoryId: 'asc' },
    });
  }

  async searchProductsByBarcode(
    organizationId: string,
    barcode: string,
  ): Promise<{ id: string; barcode: string; name: string; sku: string | null }[]> {
    const b = barcode.trim();
    if (b.length === 0) {
      return [];
    }
    return this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        barcode: { contains: b, mode: 'insensitive' },
      },
      take: 30,
      orderBy: { name: 'asc' },
      select: { id: true, barcode: true, name: true, sku: true },
    });
  }
}
