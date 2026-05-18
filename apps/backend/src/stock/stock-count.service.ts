import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockCountMode,
  StockCountSessionStatus,
  type Product,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { StockMovementService } from './stock-movement.service';
import type { CreateStockCountSessionDto, UpsertStockCountItemDto } from './stock.dto';

export interface StockCountItemRowDto {
  id: string;
  barcode: string;
  productId: string | null;
  productName: string | null;
  platformLabel: string | null;
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockCountSessionDetailDto {
  id: string;
  organizationId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  status: StockCountSessionStatus;
  countMode: StockCountMode;
  filterBrand: string | null;
  filterCategory: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  items: StockCountItemRowDto[];
}

@Injectable()
export class StockCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  private matchesPartialFilters(
    product: Product,
    filterBrand?: string | null,
    filterCategory?: string | null,
  ): boolean {
    const b = filterBrand?.trim().toLowerCase();
    const c = filterCategory?.trim().toLowerCase();
    if (!b && !c) {
      return true;
    }
    if (b && (product.brand?.trim().toLowerCase() ?? '') !== b) {
      return false;
    }
    if (c && (product.category?.trim().toLowerCase() ?? '') !== c) {
      return false;
    }
    return true;
  }

  private async resolveProduct(
    organizationId: string,
    barcode: string,
  ): Promise<Product | null> {
    const trimmed = barcode.trim();
    const direct = await this.prisma.product.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
    });
    if (direct) {
      return direct;
    }
    const variant = await this.prisma.productVariant.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
      include: { product: true },
    });
    if (variant?.product && variant.product.deletedAt === null) {
      return variant.product;
    }
    return null;
  }

  private async getCentralSystemQuantity(
    organizationId: string,
    warehouseId: string,
    barcode: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const trimmed = barcode.trim();
    const row = await client.stockEntry.findFirst({
      where: {
        organizationId,
        warehouseId,
        barcode: trimmed,
        platform: null,
      },
      select: { quantity: true },
    });
    return row?.quantity ?? 0;
  }

  private async resolvePlatformLabel(
    organizationId: string,
    warehouseId: string,
    barcode: string,
  ): Promise<string> {
    const trimmed = barcode.trim();
    const listing = await this.prisma.listing.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
      select: { platform: true },
    });
    if (listing) {
      return listing.platform;
    }
    const entry = await this.prisma.stockEntry.findFirst({
      where: {
        organizationId,
        warehouseId,
        barcode: trimmed,
        platform: { not: null },
      },
      select: { platform: true },
    });
    if (entry?.platform) {
      return entry.platform;
    }
    return 'Merkezi';
  }

  async createSession(
    organizationId: string,
    userId: string,
    dto: CreateStockCountSessionDto,
  ): Promise<{ data: { id: string } }> {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });
    if (!wh) {
      throw new NotFoundException('Depo bulunamadı.');
    }
    if (dto.countMode === StockCountMode.PARTIAL) {
      const hasFilter =
        (dto.filterBrand?.trim().length ?? 0) > 0 ||
        (dto.filterCategory?.trim().length ?? 0) > 0;
      if (!hasFilter) {
        throw new BadRequestException(
          'Kısmi sayım için marka veya kategori filtresi seçin.',
        );
      }
    }
    const row = await this.prisma.stockCountSession.create({
      data: {
        organizationId,
        warehouseId: dto.warehouseId,
        countMode: dto.countMode,
        filterBrand: dto.filterBrand?.trim() || null,
        filterCategory: dto.filterCategory?.trim() || null,
        createdBy: userId,
      },
      select: { id: true },
    });
    return { data: { id: row.id } };
  }

  async getSession(
    organizationId: string,
    sessionId: string,
  ): Promise<{ data: StockCountSessionDetailDto }> {
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id: sessionId, organizationId, deletedAt: null },
      include: {
        warehouse: { select: { name: true, code: true } },
        items: { orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    return {
      data: {
        id: session.id,
        organizationId: session.organizationId,
        warehouseId: session.warehouseId,
        warehouseName: session.warehouse.name,
        warehouseCode: session.warehouse.code,
        status: session.status,
        countMode: session.countMode,
        filterBrand: session.filterBrand,
        filterCategory: session.filterCategory,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
        createdBy: session.createdBy,
        items: session.items.map((it) => ({
          id: it.id,
          barcode: it.barcode,
          productId: it.productId,
          productName: it.productName,
          platformLabel: it.platformLabel,
          systemQuantity: it.systemQuantity,
          countedQuantity: it.countedQuantity,
          difference: it.difference,
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      },
    };
  }

  async upsertItem(
    organizationId: string,
    sessionId: string,
    dto: UpsertStockCountItemDto,
  ): Promise<{ data: StockCountItemRowDto }> {
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id: sessionId, organizationId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    if (session.status !== StockCountSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Bu oturumda sayım girişi yapılamaz.');
    }

    const barcode = dto.barcode.trim();
    if (barcode.length === 0) {
      throw new BadRequestException('Barkod boş olamaz.');
    }

    const product = await this.resolveProduct(organizationId, barcode);

    if (session.countMode === StockCountMode.PARTIAL) {
      if (!product) {
        throw new BadRequestException(
          'Bu barkod katalogda bulunamadı. Kısmi sayımda yalnızca kayıtlı ürünler sayılabilir.',
        );
      }
      if (
        !this.matchesPartialFilters(
          product,
          session.filterBrand,
          session.filterCategory,
        )
      ) {
        throw new BadRequestException(
          'Bu ürün seçilen marka veya kategori filtresine uymuyor.',
        );
      }
    }

    const systemQuantity = await this.getCentralSystemQuantity(
      organizationId,
      session.warehouseId,
      barcode,
    );
    const platformLabel = await this.resolvePlatformLabel(
      organizationId,
      session.warehouseId,
      barcode,
    );

    const difference = dto.countedQuantity - systemQuantity;

    const row = await this.prisma.stockCountItem.upsert({
      where: {
        sessionId_barcode: { sessionId, barcode },
      },
      create: {
        organizationId,
        sessionId,
        barcode,
        productId: product?.id ?? null,
        productName: product?.name ?? null,
        platformLabel,
        systemQuantity,
        countedQuantity: dto.countedQuantity,
        difference,
      },
      update: {
        productId: product?.id ?? null,
        productName: product?.name ?? null,
        platformLabel,
        systemQuantity,
        countedQuantity: dto.countedQuantity,
        difference,
      },
    });

    return {
      data: {
        id: row.id,
        barcode: row.barcode,
        productId: row.productId,
        productName: row.productName,
        platformLabel: row.platformLabel,
        systemQuantity: row.systemQuantity,
        countedQuantity: row.countedQuantity,
        difference: row.difference,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async applySession(
    organizationId: string,
    sessionId: string,
  ): Promise<{ success: true; applied: number }> {
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id: sessionId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    if (session.status !== StockCountSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Yalnızca devam eden oturumlara fark uygulanabilir.');
    }
    if (session.items.length === 0) {
      throw new BadRequestException('Sayım kalemi yok.');
    }

    let applied = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of session.items) {
        const current = await this.getCentralSystemQuantity(
          organizationId,
          session.warehouseId,
          item.barcode,
          tx,
        );
        if (current === item.countedQuantity) {
          continue;
        }
        await this.stockMovementService.adjustStockAtWarehouse(
          organizationId,
          session.warehouseId,
          item.barcode,
          item.countedQuantity,
          `Stok sayımı (${session.id})`,
          tx,
        );
        applied += 1;
      }
      await tx.stockCountSession.update({
        where: { id: sessionId },
        data: {
          status: StockCountSessionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });

    return { success: true, applied };
  }

  async cancelSession(
    organizationId: string,
    sessionId: string,
  ): Promise<{ success: true }> {
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id: sessionId, organizationId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    if (session.status !== StockCountSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Bu oturum zaten kapatılmış.');
    }
    await this.prisma.stockCountSession.update({
      where: { id: sessionId },
      data: { status: StockCountSessionStatus.CANCELLED },
    });
    return { success: true };
  }
}
