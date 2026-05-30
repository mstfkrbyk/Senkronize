import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { type Marketplace } from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { WarehouseService } from '../warehouse/warehouse.service';

import type {
  DistributionPreview,
  DistributionResult,
  ErpStockBreakdown,
  ErpStockSourceRow,
  StockDistributionStrategy,
} from './stock-distribution.types';

const VELOCITY_WINDOW_DAYS = 30;

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

@Injectable()
export class StockDistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async getErpStockBreakdown(
    organizationId: string,
    barcode: string,
  ): Promise<ErpStockBreakdown> {
    const trimmed = barcode.trim();
    const rows = await this.prisma.erpStockEntry.findMany({
      where: { organizationId, barcode: trimmed },
      include: {
        erpConnection: {
          select: { id: true, erpType: true, displayName: true, role: true },
        },
        warehouse: { select: { code: true, name: true } },
      },
      orderBy: [{ erpConnection: { role: 'asc' } }, { updatedAt: 'desc' }],
    });

    const sources: ErpStockSourceRow[] = rows.map((row) => ({
      erpConnectionId: row.erpConnectionId,
      erpType: row.erpConnection.erpType,
      displayName: row.erpConnection.displayName,
      role: row.erpConnection.role,
      quantity: row.quantity,
      warehouseCode: row.warehouse.code,
      warehouseName: row.warehouse.name,
      updatedAt: row.updatedAt.toISOString(),
    }));

    const centralRows = await this.prisma.stockEntry.findMany({
      where: { organizationId, barcode: trimmed, platform: null },
      select: { quantity: true, reservedQty: true },
    });
    const mergedTotal = centralRows.reduce(
      (sum, row) => sum + Math.max(0, row.quantity - row.reservedQty),
      0,
    );

    return { barcode: trimmed, mergedTotal, sources };
  }

  async getCurrentDistribution(
    organizationId: string,
    barcode: string,
  ): Promise<DistributionPreview> {
    const trimmed = barcode.trim();
    const rows = await this.prisma.stockEntry.findMany({
      where: { organizationId, barcode: trimmed },
    });

    const byPlatform: Record<string, number> = {};
    let totalStock = 0;

    for (const row of rows) {
      const available = Math.max(0, row.quantity - row.reservedQty);
      const key = row.platform ?? 'CENTRAL';
      byPlatform[key] = (byPlatform[key] ?? 0) + available;
      totalStock += available;
    }

    return { barcode: trimmed, totalStock, byPlatform };
  }

  async previewDistribution(
    organizationId: string,
    barcode: string,
    totalStock: number,
    strategy: StockDistributionStrategy,
  ): Promise<Record<string, number>> {
    return this.computeDistribution(organizationId, barcode, totalStock, strategy);
  }

  async distributeStock(
    organizationId: string,
    barcode: string,
    totalStock: number,
    strategy: StockDistributionStrategy,
  ): Promise<DistributionResult> {
    const trimmed = barcode.trim();
    const distribution = await this.computeDistribution(
      organizationId,
      trimmed,
      totalStock,
      strategy,
    );

    const jobIds = await this.pushDistribution(
      organizationId,
      trimmed,
      distribution,
    );

    return { distribution, pushedAt: new Date().toISOString(), jobIds };
  }

  private async computeDistribution(
    organizationId: string,
    barcode: string,
    totalStock: number,
    strategy: StockDistributionStrategy,
  ): Promise<Record<string, number>> {
    const trimmed = barcode.trim();
    const connections = await this.getActiveConnections(organizationId);
    if (connections.length === 0) {
      throw new NotFoundException('Aktif pazaryeri bağlantısı bulunamadı.');
    }

    const activePlatforms = connections.map((c) => c.platform);
    const distribution: Record<string, number> = {};

    if (strategy === 'EQUAL') {
      const perPlatform = Math.floor(totalStock / connections.length);
      let remainder = totalStock - perPlatform * connections.length;
      for (const conn of connections) {
        distribution[conn.platform] = perPlatform + (remainder > 0 ? 1 : 0);
        if (remainder > 0) {
          remainder -= 1;
        }
      }
    } else if (strategy === 'PROPORTIONAL') {
      const velocities = await this.getSalesVelocities(
        organizationId,
        trimmed,
        activePlatforms,
      );
      const total = Object.values(velocities).reduce((a, b) => a + b, 0);
      let assigned = 0;
      connections.forEach((conn, index) => {
        const ratio =
          total > 0
            ? (velocities[conn.platform] ?? 0) / total
            : 1 / connections.length;
        const qty =
          index === connections.length - 1
            ? totalStock - assigned
            : Math.floor(totalStock * ratio);
        distribution[conn.platform] = qty;
        assigned += qty;
      });
    } else if (strategy === 'PRIORITY') {
      const velocities = await this.getSalesVelocities(
        organizationId,
        trimmed,
        activePlatforms,
      );
      const sorted = [...connections].sort(
        (a, b) => (velocities[b.platform] ?? 0) - (velocities[a.platform] ?? 0),
      );
      const total = Object.values(velocities).reduce((a, b) => a + b, 0);
      let remaining = totalStock;
      sorted.forEach((conn, index) => {
        const ratio =
          total > 0
            ? (velocities[conn.platform] ?? 0) / total
            : 1 / connections.length;
        const share =
          index === sorted.length - 1
            ? remaining
            : Math.min(remaining, Math.floor(totalStock * ratio));
        distribution[conn.platform] = share;
        remaining -= share;
      });
    }

    return distribution;
  }

  private async getActiveConnections(
    organizationId: string,
  ): Promise<{ platform: Marketplace }[]> {
    return this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      select: { platform: true },
    });
  }

  private async getSalesVelocities(
    organizationId: string,
    barcode: string,
    platforms: Marketplace[],
  ): Promise<Record<string, number>> {
    const since = subDays(new Date(), VELOCITY_WINDOW_DAYS);
    const rows = await this.prisma.orderItem.groupBy({
      by: ['orderId'],
      where: {
        organizationId,
        barcode,
        order: {
          deletedAt: null,
          createdAt: { gte: since },
          platform: { in: platforms },
        },
      },
      _sum: { quantity: true },
    });

    const orderIds = rows.map((r) => r.orderId);
    if (orderIds.length === 0) {
      const empty: Record<string, number> = {};
      for (const p of platforms) {
        empty[p] = 0;
      }
      return empty;
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, organizationId },
      select: { id: true, platform: true },
    });
    const platformByOrder = new Map(orders.map((o) => [o.id, o.platform]));

    const velocities: Record<string, number> = {};
    for (const p of platforms) {
      velocities[p] = 0;
    }

    for (const row of rows) {
      const platform = platformByOrder.get(row.orderId);
      if (!platform) {
        continue;
      }
      velocities[platform] =
        (velocities[platform] ?? 0) + (row._sum.quantity ?? 0);
    }

    return velocities;
  }

  private async pushDistribution(
    organizationId: string,
    barcode: string,
    distribution: Record<string, number>,
  ): Promise<string[]> {
    const mainWarehouse =
      await this.warehouseService.getOrCreateMainWarehouse(organizationId);
    const jobIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [platformKey, quantity] of Object.entries(distribution)) {
        const platform =
          platformKey === 'CENTRAL' ? null : (platformKey as Marketplace);

        const existing = await tx.stockEntry.findFirst({
          where: {
            organizationId,
            barcode,
            platform,
            warehouseId: mainWarehouse.id,
          },
        });

        if (existing) {
          await tx.stockEntry.update({
            where: { id: existing.id },
            data: { quantity },
          });
        } else {
          const product = await tx.product.findFirst({
            where: { organizationId, barcode, deletedAt: null },
            select: { id: true },
          });
          await tx.stockEntry.create({
            data: {
              organizationId,
              barcode,
              platform,
              warehouseId: mainWarehouse.id,
              quantity,
              reservedQty: 0,
              productId: product?.id ?? null,
            },
          });
        }
      }
    });

    for (const [platformKey, quantity] of Object.entries(distribution)) {
      if (platformKey === 'CENTRAL') {
        continue;
      }
      const job = await this.marketplacePushQueue.add(
        'push-stock',
        {
          organizationId,
          platform: platformKey,
          type: 'stock',
          resourceIds: [barcode],
          payload: {
            updates: [{ barcode, quantity }],
          },
        },
        JOB_DEFAULT_OPTIONS,
      );
      jobIds.push(String(job.id));
    }

    return jobIds;
  }
}
