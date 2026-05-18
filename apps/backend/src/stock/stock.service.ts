import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { type Marketplace, Prisma } from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';

import type { BulkStockUpdateDto, StockQueryDto } from './stock.dto';

const DEFAULT_PAGE_LIMIT = 20;
const LOW_STOCK_THRESHOLD = 10;

export interface SerializedStockProduct {
  id: string;
  name: string;
  sku: string | null;
}

export interface SerializedStockEntry {
  id: string;
  organizationId: string;
  productId: string | null;
  barcode: string;
  platform: Marketplace | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  updatedAt: string;
  createdAt: string;
  product: SerializedStockProduct | null;
}

export interface StockOverviewRow {
  barcode: string;
  productName: string | null;
  sku: string | null;
  totalQuantity: number;
  totalReserved: number;
  available: number;
  lowStock: boolean;
  byPlatform: { platform: string | null; quantity: number }[];
  byWarehouse: {
    warehouseId: string;
    code: string;
    name: string;
    quantity: number;
    reservedQty: number;
  }[];
}

export type LowStockEntryRow = Prisma.StockEntryGetPayload<{
  include: { product: true };
}> & {
  availableQty: number;
};

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async findAll(
    organizationId: string,
    query: StockQueryDto,
  ): Promise<{ items: SerializedStockEntry[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.StockEntryWhereInput = {
      organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.platform !== undefined ? { platform: query.platform } : {}),
      ...(query.lowStock === true
        ? { quantity: { lt: LOW_STOCK_THRESHOLD } }
        : {}),
      ...(search && search.length > 0
        ? {
            OR: [
              { barcode: { contains: search, mode: 'insensitive' } },
              {
                product: {
                  deletedAt: null,
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    {
                      sku: { contains: search, mode: 'insensitive' },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockEntry.findMany({
        where,
        include: {
          product: {
            where: { deletedAt: null },
            select: { id: true, name: true, sku: true },
          },
          warehouse: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ barcode: 'asc' }, { platform: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.stockEntry.count({ where }),
    ]);

    const items: SerializedStockEntry[] = rows.map((row) => {
      const { product, warehouse, ...rest } = row;
      const availableQty = rest.quantity - rest.reservedQty;
      return {
        id: rest.id,
        organizationId: rest.organizationId,
        productId: rest.productId,
        barcode: rest.barcode,
        platform: rest.platform,
        warehouseId: rest.warehouseId,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        quantity: rest.quantity,
        reservedQty: rest.reservedQty,
        availableQty,
        updatedAt: rest.updatedAt.toISOString(),
        createdAt: rest.createdAt.toISOString(),
        product: product
          ? { id: product.id, name: product.name, sku: product.sku }
          : null,
      };
    });

    return { items, total };
  }

  async getLowStock(
    organizationId: string,
    threshold = 10,
  ): Promise<LowStockEntryRow[]> {
    const safeThreshold = Math.max(1, threshold);
    const rows = await this.prisma.stockEntry.findMany({
      where: { organizationId, quantity: { lt: safeThreshold } },
      include: { product: true },
      orderBy: { quantity: 'asc' },
    });
    return rows.map((row) => ({
      ...row,
      availableQty: row.quantity - row.reservedQty,
    }));
  }

  async bulkUpdate(
    organizationId: string,
    dto: BulkStockUpdateDto,
  ): Promise<{ jobIds: string[] }> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });
    const jobIds: string[] = [];
    const updatesPayload = dto.updates.map((u) => ({
      barcode: u.barcode,
      quantity: u.quantity,
    }));
    for (const conn of connections) {
      const job = await this.marketplacePushQueue.add(
        'push-stock',
        {
          organizationId,
          platform: conn.platform,
          type: 'stock',
          resourceIds: dto.updates.map((u) => u.barcode),
          payload: { updates: updatesPayload },
        },
        JOB_DEFAULT_OPTIONS,
      );
      jobIds.push(String(job.id));
    }
    return { jobIds };
  }

  async getManagementOverview(
    organizationId: string,
  ): Promise<{ rows: StockOverviewRow[] }> {
    const rows = await this.prisma.stockEntry.findMany({
      where: { organizationId },
      include: {
        product: {
          where: { deletedAt: null },
          select: { name: true, sku: true },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    type Agg = {
      barcode: string;
      productName: string | null;
      sku: string | null;
      totalQuantity: number;
      totalReserved: number;
      byPlatform: Map<string | null, number>;
      byWarehouse: Map<
        string,
        {
          warehouseId: string;
          code: string;
          name: string;
          quantity: number;
          reservedQty: number;
        }
      >;
    };

    const map = new Map<string, Agg>();

    for (const r of rows) {
      const key = r.barcode;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          barcode: r.barcode,
          productName: r.product?.name ?? null,
          sku: r.product?.sku ?? null,
          totalQuantity: 0,
          totalReserved: 0,
          byPlatform: new Map(),
          byWarehouse: new Map(),
        };
        map.set(key, agg);
      }
      agg.totalQuantity += r.quantity;
      agg.totalReserved += r.reservedQty;
      const platKey = r.platform ?? null;
      agg.byPlatform.set(
        platKey,
        (agg.byPlatform.get(platKey) ?? 0) + r.quantity,
      );
      const whId = r.warehouseId;
      const whRow = agg.byWarehouse.get(whId) ?? {
        warehouseId: r.warehouse.id,
        code: r.warehouse.code,
        name: r.warehouse.name,
        quantity: 0,
        reservedQty: 0,
      };
      whRow.quantity += r.quantity;
      whRow.reservedQty += r.reservedQty;
      agg.byWarehouse.set(whId, whRow);
    }

    const out: StockOverviewRow[] = [];
    for (const agg of map.values()) {
      const available = agg.totalQuantity - agg.totalReserved;
      out.push({
        barcode: agg.barcode,
        productName: agg.productName,
        sku: agg.sku,
        totalQuantity: agg.totalQuantity,
        totalReserved: agg.totalReserved,
        available,
        lowStock: agg.totalQuantity < LOW_STOCK_THRESHOLD,
        byPlatform: [...agg.byPlatform.entries()].map(([platform, quantity]) => ({
          platform,
          quantity,
        })),
        byWarehouse: [...agg.byWarehouse.values()],
      });
    }

    out.sort((a, b) => a.barcode.localeCompare(b.barcode));
    return { rows: out };
  }
}
