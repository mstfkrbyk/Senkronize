import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type {
  DashboardSummaryDto,
  PlatformReportRow,
  SalesReportRow,
  StockMovementRow,
  TopProductRow,
} from './reports.types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC — Pazartesi başlangıcına göre hafta anahtarı (YYYY-MM-DD). */
function periodKeyUtc(
  date: Date,
  groupBy: 'day' | 'week' | 'month',
): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  if (groupBy === 'day') {
    return `${y}-${pad2(m + 1)}-${pad2(day)}`;
  }
  if (groupBy === 'month') {
    return `${y}-${pad2(m + 1)}`;
  }
  const jd = Date.UTC(y, m, day);
  const dow = date.getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  const monMs = jd - mondayOffset * 86_400_000;
  const mon = new Date(monMs);
  return `${mon.getUTCFullYear()}-${pad2(mon.getUTCMonth() + 1)}-${pad2(mon.getUTCDate())}`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(
    organizationId: string,
  ): Promise<DashboardSummaryDto> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const orderBase: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
    };

    const [
      todayOrders,
      yesterdayOrders,
      pendingOrders,
      totalProducts,
      activeConnections,
      totalConnections,
      lowStockCount,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: { gte: startOfToday },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: {
            gte: startOfYesterday,
            lt: startOfToday,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          status: {
            in: [
              OrderStatus.NEW,
              OrderStatus.PICKING,
              OrderStatus.INVOICED,
            ],
          },
        },
      }),
      this.prisma.product.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.marketplaceConnection.count({
        where: { organizationId, deletedAt: null, isActive: true },
      }),
      this.prisma.marketplaceConnection.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.listing.count({
        where: {
          organizationId,
          deletedAt: null,
          quantity: { gt: 0, lte: 5 },
        },
      }),
    ]);

    let todayOrdersDelta = 0;
    if (yesterdayOrders === 0) {
      todayOrdersDelta = todayOrders > 0 ? 100 : 0;
    } else {
      todayOrdersDelta = Math.round(
        ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100,
      );
    }

    return {
      todayOrders,
      todayOrdersDelta,
      pendingOrders,
      totalProducts,
      activeConnections,
      totalConnections,
      lowStockCount,
    };
  }

  async getSalesReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<SalesReportRow[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        platformCreatedAt: { gte: startDate, lte: endDate },
        deletedAt: null,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      },
      select: {
        platformCreatedAt: true,
        totalAmount: true,
        platform: true,
      },
    });

    const grouped = new Map<
      string,
      {
        totalOrders: number;
        totalRevenue: number;
        byPlatform: Record<string, number>;
      }
    >();

    for (const order of orders) {
      const key = periodKeyUtc(order.platformCreatedAt, groupBy);
      if (!grouped.has(key)) {
        grouped.set(key, {
          totalOrders: 0,
          totalRevenue: 0,
          byPlatform: {},
        });
      }
      const entry = grouped.get(key)!;
      entry.totalOrders++;
      entry.totalRevenue += Number(order.totalAmount);
      const p = order.platform;
      entry.byPlatform[p] = (entry.byPlatform[p] ?? 0) + 1;
    }

    return Array.from(grouped.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getPlatformReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PlatformReportRow[]> {
    const rows = await this.prisma.order.groupBy({
      by: ['platform'],
      where: {
        organizationId,
        deletedAt: null,
        platformCreatedAt: { gte: startDate, lte: endDate },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    return rows.map((r) => ({
      platform: r.platform,
      orderCount: r._count._all,
      revenue: Number(r._sum.totalAmount ?? 0),
    }));
  }

  async getTopProducts(
    organizationId: string,
    limit = 20,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TopProductRow[]> {
    const orderFilter: Prisma.OrderWhereInput | undefined =
      startDate && endDate
        ? {
            platformCreatedAt: { gte: startDate, lte: endDate },
            deletedAt: null,
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
          }
        : undefined;

    const items = await this.prisma.orderItem.groupBy({
      by: ['barcode'],
      where: {
        organizationId,
        ...(orderFilter && { order: orderFilter }),
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return items.map((item) => ({
      barcode: item.barcode,
      totalQuantity: item._sum.quantity ?? 0,
      orderCount: item._count.id,
    }));
  }

  async getStockMovementReport(
    organizationId: string,
    limit = 100,
    startDate?: Date,
    endDate?: Date,
  ): Promise<StockMovementRow[]> {
    const updatedAt: Prisma.DateTimeFilter | undefined =
      startDate && endDate
        ? { gte: startDate, lte: endDate }
        : startDate
          ? { gte: startDate }
          : endDate
            ? { lte: endDate }
            : undefined;

    const rows = await this.prisma.stockEntry.findMany({
      where: {
        organizationId,
        ...(updatedAt && { updatedAt }),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        barcode: true,
        platform: true,
        quantity: true,
        reservedQty: true,
        updatedAt: true,
      },
    });

    return rows.map((r) => ({
      barcode: r.barcode,
      platform: r.platform,
      quantity: r.quantity,
      reservedQty: r.reservedQty,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}
