import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type {
  SeasonalityDataDto,
  StockForecastSummaryDto,
  StockoutEstimateDto,
  StockProjectionDto,
} from './stock-forecast.types';

const VELOCITY_WINDOW_DAYS = 30;
const PRIOR_WINDOW_DAYS = 30;
const MAX_FORECAST_PRODUCTS = 5000;

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

@Injectable()
export class StockForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableStockByBarcodes(
    organizationId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.stockEntry.groupBy({
      by: ['barcode'],
      where: { organizationId },
      _sum: { quantity: true, reservedQty: true },
    });
    const map = new Map<string, number>();
    for (const r of rows) {
      const qty = r._sum.quantity ?? 0;
      const res = r._sum.reservedQty ?? 0;
      map.set(r.barcode, Math.max(0, qty - res));
    }
    return map;
  }

  async calculateVelocity(
    organizationId: string,
    barcode: string,
    days: number = VELOCITY_WINDOW_DAYS,
  ): Promise<number> {
    const since = subDays(new Date(), days);
    const agg = await this.prisma.orderItem.aggregate({
      where: {
        organizationId,
        barcode,
        order: { deletedAt: null, createdAt: { gte: since } },
      },
      _sum: { quantity: true },
    });
    const totalQuantity = agg._sum.quantity ?? 0;
    return totalQuantity / days;
  }

  private async getCurrentStock(
    organizationId: string,
    barcode: string,
  ): Promise<number> {
    const map = await this.getAvailableStockByBarcodes(organizationId);
    return map.get(barcode) ?? 0;
  }

  private async velocitySince(
    organizationId: string,
    barcode: string,
    since: Date,
    until: Date,
  ): Promise<number> {
    const ms = until.getTime() - since.getTime();
    const daySpan = Math.max(1, Math.round(ms / 86_400_000));
    const agg = await this.prisma.orderItem.aggregate({
      where: {
        organizationId,
        barcode,
        order: {
          deletedAt: null,
          createdAt: { gte: since, lt: until },
        },
      },
      _sum: { quantity: true },
    });
    const total = agg._sum.quantity ?? 0;
    return total / daySpan;
  }

  async estimateStockout(
    organizationId: string,
    barcode: string,
    productRow?: {
      id: string;
      name: string;
      sku: string | null;
      reorderPoint: number | null;
      reorderQty: number | null;
      leadTimeDays: number | null;
      costPrice: Prisma.Decimal | null;
    },
    stockMap?: Map<string, number>,
    velocityOverride?: number,
  ): Promise<StockoutEstimateDto> {
    const velocity =
      velocityOverride ??
      (await this.calculateVelocity(organizationId, barcode));
    const currentStock =
      stockMap !== undefined
        ? (stockMap.get(barcode) ?? 0)
        : await this.getCurrentStock(organizationId, barcode);

    const daysUntilStockout =
      velocity > 0 ? currentStock / velocity : null;

    let estimatedStockoutDate: string | null = null;
    if (
      daysUntilStockout !== null &&
      Number.isFinite(daysUntilStockout) &&
      daysUntilStockout >= 0
    ) {
      estimatedStockoutDate = addDaysUtc(
        startOfUtcDay(new Date()),
        Math.ceil(daysUntilStockout),
      ).toISOString();
    }

    const recommendedOrderQty =
      velocity > 0 ? Math.max(1, Math.ceil(velocity * 30)) : 0;

    const product =
      productRow ??
      (await this.prisma.product.findFirst({
        where: { organizationId, barcode, deletedAt: null },
        select: {
          id: true,
          name: true,
          sku: true,
          reorderPoint: true,
          reorderQty: true,
          leadTimeDays: true,
          costPrice: true,
        },
      }));

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    const belowReorder =
      product.reorderPoint !== null &&
      product.reorderPoint !== undefined &&
      currentStock < product.reorderPoint;

    const unitCostTry =
      product.costPrice !== null && product.costPrice !== undefined
        ? Number(product.costPrice)
        : null;

    return {
      productId: product.id,
      barcode,
      name: product.name,
      sku: product.sku,
      currentStock,
      dailyVelocity: Math.round(velocity * 10_000) / 10_000,
      daysUntilStockout:
        daysUntilStockout === null || !Number.isFinite(daysUntilStockout)
          ? null
          : Math.round(daysUntilStockout * 100) / 100,
      estimatedStockoutDate,
      recommendedOrderQty,
      reorderPoint: product.reorderPoint,
      reorderQty: product.reorderQty,
      leadTimeDays: product.leadTimeDays,
      belowReorder,
      unitCostTry,
    };
  }

  async bulkForecast(
    organizationId: string,
    maxItems: number = MAX_FORECAST_PRODUCTS,
  ): Promise<StockoutEstimateDto[]> {
    const take = Math.min(Math.max(1, maxItems), MAX_FORECAST_PRODUCTS);
    const products = await this.prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        barcode: true,
        name: true,
        sku: true,
        reorderPoint: true,
        reorderQty: true,
        leadTimeDays: true,
        costPrice: true,
      },
      orderBy: { name: 'asc' },
      take,
    });

    const since = subDays(new Date(), VELOCITY_WINDOW_DAYS);
    const velocityRows = await this.prisma.orderItem.groupBy({
      by: ['barcode'],
      where: {
        organizationId,
        order: { deletedAt: null, createdAt: { gte: since } },
      },
      _sum: { quantity: true },
    });
    const velocityByBarcode = new Map<string, number>();
    for (const row of velocityRows) {
      const total = row._sum.quantity ?? 0;
      velocityByBarcode.set(row.barcode, total / VELOCITY_WINDOW_DAYS);
    }

    const stockMap = await this.getAvailableStockByBarcodes(organizationId);

    const out: StockoutEstimateDto[] = [];
    for (const p of products) {
      const v = velocityByBarcode.get(p.barcode) ?? 0;
      const est = await this.estimateStockout(
        organizationId,
        p.barcode,
        p,
        stockMap,
        v,
      );
      out.push(est);
    }
    return out;
  }

  async getCriticalStockItems(
    organizationId: string,
    maxDays = 7,
  ): Promise<StockoutEstimateDto[]> {
    const bulk = await this.bulkForecast(organizationId);
    return bulk.filter((row) => {
      if (row.daysUntilStockout === null) {
        return false;
      }
      return row.daysUntilStockout >= 0 && row.daysUntilStockout < maxDays;
    });
  }

  async getForecastSummary(
    organizationId: string,
  ): Promise<StockForecastSummaryDto> {
    const bulk = await this.bulkForecast(organizationId);
    let countWithin7Days = 0;
    let countWithin14Days = 0;
    let countWithin30Days = 0;
    let estimatedRestockCostThisMonthTry = 0;

    for (const row of bulk) {
      const d = row.daysUntilStockout;
      if (d === null || !Number.isFinite(d) || d < 0) {
        continue;
      }
      if (d <= 30) {
        countWithin30Days += 1;
      }
      if (d <= 14) {
        countWithin14Days += 1;
      }
      if (d < 7) {
        countWithin7Days += 1;
      }
      if (d <= 30 && row.recommendedOrderQty > 0 && row.unitCostTry !== null) {
        estimatedRestockCostThisMonthTry +=
          row.recommendedOrderQty * row.unitCostTry;
      }
    }

    return {
      countWithin7Days,
      countWithin14Days,
      countWithin30Days,
      estimatedRestockCostThisMonthTry:
        Math.round(estimatedRestockCostThisMonthTry * 100) / 100,
    };
  }

  async analyzeSeasonality(
    organizationId: string,
    barcode: string,
  ): Promise<SeasonalityDataDto> {
    const now = new Date();
    const recentStart = subDays(now, VELOCITY_WINDOW_DAYS);
    const priorStart = subDays(now, VELOCITY_WINDOW_DAYS + PRIOR_WINDOW_DAYS);
    const priorEnd = recentStart;

    const [recentVelocity, priorVelocity] = await Promise.all([
      this.velocitySince(organizationId, barcode, recentStart, now),
      this.velocitySince(organizationId, barcode, priorStart, priorEnd),
    ]);

    const seasonalityIndex =
      priorVelocity > 0.0001
        ? recentVelocity / priorVelocity
        : recentVelocity > 0
          ? 2
          : 1;

    let trendLabel: SeasonalityDataDto['trendLabel'] = 'stabil';
    if (seasonalityIndex > 1.15) {
      trendLabel = 'yükseliş';
    } else if (seasonalityIndex < 0.85) {
      trendLabel = 'düşüş';
    }

    return {
      barcode,
      recentVelocity: Math.round(recentVelocity * 10_000) / 10_000,
      priorVelocity: Math.round(priorVelocity * 10_000) / 10_000,
      seasonalityIndex: Math.round(seasonalityIndex * 100) / 100,
      trendLabel,
    };
  }

  async getProjection(
    organizationId: string,
    barcode: string,
    horizonDays = 30,
  ): Promise<StockProjectionDto> {
    const product = await this.prisma.product.findFirst({
      where: { organizationId, barcode, deletedAt: null },
      select: { reorderPoint: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    const velocity = await this.calculateVelocity(organizationId, barcode);
    const currentStock = await this.getCurrentStock(organizationId, barcode);
    const points: StockProjectionDto['points'] = [];
    const base = startOfUtcDay(new Date());
    for (let d = 0; d <= horizonDays; d += 1) {
      const projected = Math.max(0, currentStock - velocity * d);
      points.push({
        dayOffset: d,
        date: addDaysUtc(base, d).toISOString(),
        projectedStock: Math.round(projected * 100) / 100,
      });
    }
    return {
      barcode,
      currentStock,
      dailyVelocity: Math.round(velocity * 10_000) / 10_000,
      reorderPoint: product.reorderPoint,
      points,
    };
  }
}
