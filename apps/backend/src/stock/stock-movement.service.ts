import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType, type StockMovement } from '@prisma/client';

import { CacheKeys } from '../common/cache/cache-keys';
import { CACHE_TTL } from '../common/cache/cache-ttl';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { WarehouseService } from '../warehouse/warehouse.service';

export interface StockMovementRecordParams {
  organizationId: string;
  barcode: string;
  warehouseId?: string | null;
  platform?: string | null;
  movementType: StockMovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  orderId?: string | null;
  note?: string | null;
  tx?: Prisma.TransactionClient;
}

export interface StockMovementHistoryOptions {
  from?: Date;
  to?: Date;
  movementType?: StockMovementType;
  movementTypes?: StockMovementType[];
  barcode?: string;
  platform?: string;
  warehouseId?: string;
  page?: number;
  limit?: number;
}

export interface MovementSummary {
  from: string;
  to: string;
  byType: Record<string, number>;
}

export interface DailyMovementFlowPoint {
  date: string;
  inflow: number;
  outflow: number;
}

@Injectable()
export class StockMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
    private readonly cache: CacheService,
  ) {}

  async record(params: StockMovementRecordParams): Promise<StockMovement> {
    const client = params.tx ?? this.prisma;
    const row = await client.stockMovement.create({
      data: {
        organizationId: params.organizationId,
        barcode: params.barcode,
        warehouseId: params.warehouseId ?? null,
        platform: params.platform ?? null,
        movementType: params.movementType,
        quantity: params.quantity,
        beforeQuantity: params.beforeQuantity,
        afterQuantity: params.afterQuantity,
        orderId: params.orderId ?? null,
        note: params.note ?? null,
      },
    });
    if (!params.tx) {
      void this.cache.invalidateStockForOrg(params.organizationId);
    }
    return row;
  }

  async getHistory(
    organizationId: string,
    barcode: string,
    options: StockMovementHistoryOptions,
  ): Promise<StockMovement[]> {
    const where: Prisma.StockMovementWhereInput = {
      organizationId,
      barcode,
      ...(options.from || options.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
      ...(options.movementType
        ? { movementType: options.movementType }
        : {}),
      ...(options.platform !== undefined && options.platform !== ''
        ? { platform: options.platform }
        : {}),
    };
    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 200,
    });
  }

  async getOrgHistory(
    organizationId: string,
    options: StockMovementHistoryOptions,
  ): Promise<{ data: StockMovement[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const search = options.barcode?.trim();

    const where: Prisma.StockMovementWhereInput = {
      organizationId,
      ...(options.from || options.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
      ...(options.movementTypes && options.movementTypes.length > 0
        ? { movementType: { in: options.movementTypes } }
        : options.movementType
          ? { movementType: options.movementType }
          : {}),
      ...(options.platform !== undefined && options.platform !== ''
        ? { platform: options.platform }
        : {}),
      ...(options.warehouseId && options.warehouseId.length > 0
        ? { warehouseId: options.warehouseId }
        : {}),
      ...(search && search.length > 0
        ? { barcode: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, total };
  }

  async getDailyMovementFlow(
    organizationId: string,
    days = 30,
  ): Promise<DailyMovementFlowPoint[]> {
    const safeDays = Math.min(Math.max(1, days), 90);
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - safeDays);
    from.setUTCHours(0, 0, 0, 0);

    const rows = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        createdAt: { gte: from, lte: to },
      },
      select: { createdAt: true, quantity: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<string, { inflow: number; outflow: number }>();
    for (let i = 0; i <= safeDays; i += 1) {
      const d = new Date(from);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { inflow: 0, outflow: 0 });
    }

    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) {
        continue;
      }
      if (row.quantity > 0) {
        bucket.inflow += row.quantity;
      } else if (row.quantity < 0) {
        bucket.outflow += Math.abs(row.quantity);
      }
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date,
        inflow: row.inflow,
        outflow: row.outflow,
      }));
  }

  async getMovementSummary(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<MovementSummary> {
    const cacheKey = `${CacheKeys.stockSummary(organizationId)}:${from.toISOString()}:${to.toISOString()}`;
    return this.cache.readThrough(cacheKey, CACHE_TTL.PRODUCT_STOCK, async () => {
      const rows = await this.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where: {
          organizationId,
          createdAt: { gte: from, lte: to },
        },
        _sum: { quantity: true },
      });
      const byType: Record<string, number> = {};
      for (const r of rows) {
        byType[r.movementType] = r._sum.quantity ?? 0;
      }
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        byType,
      };
    });
  }

  async adjustStock(
    organizationId: string,
    barcode: string,
    newQuantity: number,
    note?: string,
  ): Promise<void> {
    const main = await this.warehouseService.getOrCreateMainWarehouse(
      organizationId,
    );
    await this.adjustStockAtWarehouse(
      organizationId,
      main.id,
      barcode,
      newQuantity,
      note,
    );
  }

  /**
   * Merkezi stok (platform=null) satırını günceller ve ADJUSTMENT hareketi yazar.
   * @param tx — dışarıdan açılmış bir transaction içinde çağrılabilir.
   */
  async adjustStockAtWarehouse(
    organizationId: string,
    warehouseId: string,
    barcode: string,
    newQuantity: number,
    note?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const trimmed = barcode.trim();
    const client = tx ?? this.prisma;

    const warehouse = await client.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
    });
    if (!warehouse) {
      throw new NotFoundException('Depo bulunamadı.');
    }

    const product = await client.product.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
      select: { id: true },
    });

    const run = async (db: Prisma.TransactionClient): Promise<void> => {
      const existing = await db.stockEntry.findFirst({
        where: {
          organizationId,
          barcode: trimmed,
          platform: null,
          warehouseId,
        },
      });
      const before = existing?.quantity ?? 0;
      const after = newQuantity;
      if (existing) {
        await db.stockEntry.update({
          where: { id: existing.id },
          data: {
            quantity: after,
            ...(product ? { productId: product.id } : {}),
          },
        });
      } else {
        await db.stockEntry.create({
          data: {
            organizationId,
            warehouseId,
            barcode: trimmed,
            platform: null,
            quantity: after,
            productId: product?.id ?? null,
          },
        });
      }
      await this.record({
        organizationId,
        barcode: trimmed,
        warehouseId,
        platform: null,
        movementType: StockMovementType.ADJUSTMENT,
        quantity: after - before,
        beforeQuantity: before,
        afterQuantity: after,
        note: note?.trim() || null,
        tx: db,
      });
    };

    if (tx) {
      await run(tx);
      return;
    }

    await this.prisma.$transaction(async (inner) => {
      await run(inner);
    });
  }

  /**
   * Merkezi stok (platform=null) miktarını artırır ve PURCHASE hareketi yazar.
   */
  async applyPurchaseInflow(
    organizationId: string,
    warehouseId: string,
    barcode: string,
    delta: number,
    note: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new BadRequestException('Teslim miktarı pozitif bir sayı olmalıdır.');
    }
    const trimmed = barcode.trim();
    const client = tx ?? this.prisma;

    const warehouse = await client.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
    });
    if (!warehouse) {
      throw new NotFoundException('Depo bulunamadı.');
    }

    const product = await client.product.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
      select: { id: true },
    });

    const run = async (db: Prisma.TransactionClient): Promise<void> => {
      const existing = await db.stockEntry.findFirst({
        where: {
          organizationId,
          barcode: trimmed,
          platform: null,
          warehouseId,
        },
      });
      const before = existing?.quantity ?? 0;
      const after = before + delta;
      if (existing) {
        await db.stockEntry.update({
          where: { id: existing.id },
          data: {
            quantity: after,
            ...(product ? { productId: product.id } : {}),
          },
        });
      } else {
        await db.stockEntry.create({
          data: {
            organizationId,
            warehouseId,
            barcode: trimmed,
            platform: null,
            quantity: after,
            productId: product?.id ?? null,
          },
        });
      }
      await this.record({
        organizationId,
        barcode: trimmed,
        warehouseId,
        platform: null,
        movementType: StockMovementType.PURCHASE,
        quantity: after - before,
        beforeQuantity: before,
        afterQuantity: after,
        note: note?.trim() || null,
        tx: db,
      });
    };

    if (tx) {
      await run(tx);
      return;
    }

    await this.prisma.$transaction(async (inner) => {
      await run(inner);
    });
  }
}
