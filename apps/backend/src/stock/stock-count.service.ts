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
import Papa from 'papaparse';

import { PrismaService } from '../prisma/prisma.service';

import { StockCountPdfService } from './stock-count-pdf.service';
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
  differenceValue: number | null;
  unitCost: number | null;
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
  varianceSummary: {
    totalDifferenceUnits: number;
    totalDifferenceValue: number;
    itemsWithVariance: number;
  };
}

interface CsvCountRow {
  barcode?: string;
  Barkod?: string;
  countedQuantity?: string | number;
  'Sayılan'?: string | number;
  Sayilan?: string | number;
  quantity?: string | number;
}

@Injectable()
export class StockCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly stockCountPdfService: StockCountPdfService,
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

  private unitCostFromProduct(
    product: { costPrice: Prisma.Decimal | null } | null | undefined,
  ): number | null {
    if (!product?.costPrice) {
      return null;
    }
    const n = Number(product.costPrice);
    return Number.isFinite(n) ? n : null;
  }

  private mapItemRow(
    it: {
      id: string;
      barcode: string;
      productId: string | null;
      productName: string | null;
      platformLabel: string | null;
      systemQuantity: number;
      countedQuantity: number;
      difference: number;
      createdAt: Date;
      updatedAt: Date;
      product?: { costPrice: Prisma.Decimal | null } | null;
    },
    unitCost?: number | null,
  ): StockCountItemRowDto {
    const cost = unitCost ?? this.unitCostFromProduct(it.product);
    const differenceValue =
      cost !== null ? Number((it.difference * cost).toFixed(2)) : null;
    return {
      id: it.id,
      barcode: it.barcode,
      productId: it.productId,
      productName: it.productName,
      platformLabel: it.platformLabel,
      systemQuantity: it.systemQuantity,
      countedQuantity: it.countedQuantity,
      difference: it.difference,
      differenceValue,
      unitCost: cost,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
    };
  }

  private buildVarianceSummary(items: StockCountItemRowDto[]): {
    totalDifferenceUnits: number;
    totalDifferenceValue: number;
    itemsWithVariance: number;
  } {
    let totalDifferenceUnits = 0;
    let totalDifferenceValue = 0;
    let itemsWithVariance = 0;
    for (const it of items) {
      if (it.difference !== 0) {
        itemsWithVariance += 1;
        totalDifferenceUnits += it.difference;
        totalDifferenceValue += it.differenceValue ?? 0;
      }
    }
    return {
      totalDifferenceUnits,
      totalDifferenceValue: Number(totalDifferenceValue.toFixed(2)),
      itemsWithVariance,
    };
  }

  private async loadSheetRows(
    organizationId: string,
    session: {
      id: string;
      warehouseId: string;
      countMode: StockCountMode;
      filterBrand: string | null;
      filterCategory: string | null;
      items: {
        barcode: string;
        productName: string | null;
        systemQuantity: number;
      }[];
    },
  ): Promise<{ barcode: string; productName: string; systemQuantity: number }[]> {
    if (session.items.length > 0) {
      return session.items.map((it) => ({
        barcode: it.barcode,
        productName: it.productName ?? '—',
        systemQuantity: it.systemQuantity,
      }));
    }

    const entries = await this.prisma.stockEntry.findMany({
      where: {
        organizationId,
        warehouseId: session.warehouseId,
        platform: null,
        quantity: { gt: 0 },
      },
      orderBy: { barcode: 'asc' },
      select: { barcode: true, quantity: true, productId: true },
    });

    const rows: { barcode: string; productName: string; systemQuantity: number }[] = [];
    for (const entry of entries) {
      const product = entry.productId
        ? await this.prisma.product.findFirst({
            where: { id: entry.productId, organizationId, deletedAt: null },
          })
        : await this.resolveProduct(organizationId, entry.barcode);
      if (
        session.countMode === StockCountMode.PARTIAL &&
        product &&
        !this.matchesPartialFilters(
          product,
          session.filterBrand,
          session.filterCategory,
        )
      ) {
        continue;
      }
      rows.push({
        barcode: entry.barcode,
        productName: product?.name ?? entry.barcode,
        systemQuantity: entry.quantity,
      });
    }
    return rows;
  }

  async exportCountSheet(
    organizationId: string,
    sessionId: string,
  ): Promise<Buffer> {
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id: sessionId, organizationId, deletedAt: null },
      include: {
        warehouse: { select: { name: true, code: true } },
        items: { orderBy: { barcode: 'asc' } },
      },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    if (session.status === StockCountSessionStatus.CANCELLED) {
      throw new BadRequestException('İptal edilmiş oturum için form üretilemez.');
    }

    const rows = await this.loadSheetRows(organizationId, session);
    return this.stockCountPdfService.generateCountSheetPdf(
      {
        sessionId: session.id,
        warehouseName: session.warehouse.name,
        warehouseCode: session.warehouse.code,
        countMode:
          session.countMode === StockCountMode.FULL ? 'Tam sayım' : 'Kısmi sayım',
        startedAt: session.startedAt.toLocaleDateString('tr-TR'),
      },
      rows,
    );
  }

  async importCountResult(
    organizationId: string,
    sessionId: string,
    csvBuffer: Buffer,
  ): Promise<{ data: { imported: number; skipped: number } }> {
    const session = await this.prisma.stockCountSession.findFirst({
      where: { id: sessionId, organizationId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    if (session.status !== StockCountSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Yalnızca devam eden oturumlara CSV yüklenebilir.');
    }

    const parsed = Papa.parse<CsvCountRow>(csvBuffer.toString('utf-8'), {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      throw new BadRequestException('CSV dosyası okunamadı.');
    }

    let imported = 0;
    let skipped = 0;
    for (const row of parsed.data) {
      const barcode = (row.barcode ?? row.Barkod ?? '').trim();
      const rawQty =
        row.countedQuantity ?? row['Sayılan'] ?? row.Sayilan ?? row.quantity;
      const qty =
        typeof rawQty === 'number'
          ? rawQty
          : Number.parseInt(String(rawQty ?? '').trim(), 10);
      if (!barcode || !Number.isFinite(qty) || qty < 0) {
        skipped += 1;
        continue;
      }
      await this.upsertItem(organizationId, sessionId, {
        barcode,
        countedQuantity: qty,
      });
      imported += 1;
    }

    return { data: { imported, skipped } };
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
        items: {
          orderBy: { updatedAt: 'desc' },
          include: {
            product: { select: { costPrice: true } },
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundException('Sayım oturumu bulunamadı.');
    }
    const items = session.items.map((it) => this.mapItemRow(it));
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
        items,
        varianceSummary: this.buildVarianceSummary(items),
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
      include: {
        product: { select: { costPrice: true } },
      },
    });

    return {
      data: this.mapItemRow(row),
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
