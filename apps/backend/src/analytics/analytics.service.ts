import { Injectable } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';

import { readThroughCache } from '../common/cache/cache.decorator';
import { CacheService } from '../common/cache/cache.service';
import {
  MARKETPLACE_LABEL_TR,
  ReportsService,
} from '../reports/reports.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  parsePeriodDays,
  rangeForDays,
  rangeWithPrevious,
} from './analytics-period.util';
import type {
  AovTrendResponse,
  CustomerInsightsResponse,
  DailyRevenueTrendResponse,
  PlatformComparisonResponse,
  RevenueByHourResponse,
  TopProductsResponse,
  TopReturnedProductsResponse,
} from './analytics.types';

const COMPLETED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
];

function pctDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function extractCityFromAddress(address: string | null | undefined): string {
  const line = (address ?? '').trim();
  if (line.length === 0) {
    return 'Belirtilmemiş';
  }
  const parts = line
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return parts[parts.length - 1] ?? 'Belirtilmemiş';
  }
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

function customerKey(name: string, phone: string | null): string {
  const p = (phone ?? '').trim();
  if (p.length > 0) {
    return `tel:${p}`;
  }
  return `name:${name.trim().toLowerCase()}`;
}

function dayKeys(days: number): { iso: string; label: string }[] {
  const res: { iso: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0] ?? '';
    res.push({
      iso,
      label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    });
  }
  return res;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly reports: ReportsService,
  ) {}

  async getPlatformComparison(
    organizationId: string,
    period: string | undefined,
  ): Promise<PlatformComparisonResponse> {
    const periodDays = parsePeriodDays(period, 30);
    const { current, previous } = rangeWithPrevious(periodDays);
    const cacheKey = CacheService.key(
      'analytics',
      'platform-comparison',
      organizationId,
      String(periodDays),
    );

    return readThroughCache(this.cache, cacheKey, 300, async () => {
      const baseWhere = (from: Date, to: Date): Prisma.OrderWhereInput => ({
        organizationId,
        deletedAt: null,
        platformCreatedAt: { gte: from, lte: to },
      });

      const [
        goodCurrent,
        totalCurrent,
        badCurrent,
        goodPrevious,
        buyBoxByPlatform,
      ] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['platform'],
          where: {
            ...baseWhere(current.from, current.to),
            status: { notIn: COMPLETED_ORDER_STATUSES },
          },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.groupBy({
          by: ['platform'],
          where: baseWhere(current.from, current.to),
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ['platform'],
          where: {
            ...baseWhere(current.from, current.to),
            status: { in: COMPLETED_ORDER_STATUSES },
          },
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ['platform'],
          where: {
            ...baseWhere(previous.from, previous.to),
            status: { notIn: COMPLETED_ORDER_STATUSES },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.buyBoxSnapshot.groupBy({
          by: ['platform'],
          where: {
            organizationId,
            capturedAt: { gte: current.from },
          },
          _count: { _all: true },
        }),
      ]);

      const buyBoxWins = await this.prisma.buyBoxSnapshot.groupBy({
        by: ['platform'],
        where: {
          organizationId,
          isWinner: true,
          capturedAt: { gte: current.from },
        },
        _count: { _all: true },
      });

      const winMap = new Map(
        buyBoxWins.map((r) => [r.platform, r._count._all] as const),
      );
      const checkMap = new Map(
        buyBoxByPlatform.map((r) => [r.platform, r._count._all] as const),
      );
      const prevRevMap = new Map(
        goodPrevious.map(
          (r) => [r.platform, Number(r._sum.totalAmount ?? 0)] as const,
        ),
      );

      const goodMap = new Map(
        goodCurrent.map(
          (r) =>
            [
              r.platform,
              {
                orderCount: r._count._all,
                revenue: Number(r._sum.totalAmount ?? 0),
              },
            ] as const,
        ),
      );
      const totalMap = new Map(
        totalCurrent.map((r) => [r.platform, r._count._all] as const),
      );
      const badMap = new Map(
        badCurrent.map((r) => [r.platform, r._count._all] as const),
      );

      const platformSet = new Set<Marketplace>([
        ...goodMap.keys(),
        ...totalMap.keys(),
      ]);

      const platforms = Array.from(platformSet)
        .sort((a, b) => a.localeCompare(b))
        .map((platform) => {
          const good = goodMap.get(platform);
          const orderCount = good?.orderCount ?? 0;
          const revenue = good?.revenue ?? 0;
          const avgBasket = orderCount > 0 ? revenue / orderCount : 0;
          const totalOrders = totalMap.get(platform) ?? 0;
          const badOrders = badMap.get(platform) ?? 0;
          const returnRate =
            totalOrders > 0
              ? Math.round((badOrders / totalOrders) * 1000) / 10
              : 0;
          const checks = checkMap.get(platform) ?? 0;
          const wins = winMap.get(platform) ?? 0;
          const buyBoxWinRate =
            checks > 0 ? Math.round((wins / checks) * 1000) / 10 : 0;
          const prevRevenue = prevRevMap.get(platform) ?? 0;
          const growthPct = pctDelta(revenue, prevRevenue);

          return {
            platform,
            label:
              MARKETPLACE_LABEL_TR[platform] ?? platform,
            orderCount,
            revenue: Math.round(revenue * 100) / 100,
            avgBasket: Math.round(avgBasket * 100) / 100,
            returnRate,
            buyBoxWinRate,
            growthPct,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      return { periodDays, platforms };
    });
  }

  async getCustomerInsights(
    organizationId: string,
    period: string | undefined,
  ): Promise<CustomerInsightsResponse> {
    const periodDays = parsePeriodDays(period, 30);
    const { from, to } = rangeForDays(periodDays);
    const cacheKey = CacheService.key(
      'analytics',
      'customer-insights',
      organizationId,
      String(periodDays),
    );

    return readThroughCache(this.cache, cacheKey, 300, async () => {
      const orders = await this.prisma.order.findMany({
        where: {
          organizationId,
          deletedAt: null,
          platformCreatedAt: { gte: from, lte: to },
          status: { notIn: COMPLETED_ORDER_STATUSES },
        },
        select: {
          customerName: true,
          customerPhone: true,
          totalAmount: true,
          shippingAddress: true,
        },
      });

      const customerOrderCounts = new Map<string, number>();
      const cityStats = new Map<string, { orderCount: number; revenue: number }>();
      let totalRevenue = 0;

      for (const order of orders) {
        totalRevenue += Number(order.totalAmount);
        const key = customerKey(order.customerName, order.customerPhone);
        customerOrderCounts.set(key, (customerOrderCounts.get(key) ?? 0) + 1);

        const city = extractCityFromAddress(order.shippingAddress);
        const cityEntry = cityStats.get(city) ?? { orderCount: 0, revenue: 0 };
        cityEntry.orderCount++;
        cityEntry.revenue += Number(order.totalAmount);
        cityStats.set(city, cityEntry);
      }

      const totalCustomers = customerOrderCounts.size;
      let repeatCustomers = 0;
      for (const count of customerOrderCounts.values()) {
        if (count > 1) {
          repeatCustomers++;
        }
      }

      const repeatCustomerRate =
        totalCustomers > 0
          ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10
          : 0;
      const avgOrderValue =
        orders.length > 0
          ? Math.round((totalRevenue / orders.length) * 100) / 100
          : 0;

      const topCities = Array.from(cityStats.entries())
        .map(([city, stats]) => ({
          city,
          orderCount: stats.orderCount,
          revenue: Math.round(stats.revenue * 100) / 100,
        }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 15);

      return {
        periodDays,
        repeatCustomerRate,
        avgOrderValue,
        totalCustomers,
        repeatCustomers,
        topCities,
      };
    });
  }

  async getRevenueByHour(
    organizationId: string,
    days: number | undefined,
  ): Promise<RevenueByHourResponse> {
    const safeDays = Math.min(Math.max(days ?? 30, 1), 365);
    const { from, to } = rangeForDays(safeDays);
    const cacheKey = CacheService.key(
      'analytics',
      'revenue-by-hour',
      organizationId,
      String(safeDays),
    );

    return readThroughCache(this.cache, cacheKey, 300, async () => {
      const orders = await this.prisma.order.findMany({
        where: {
          organizationId,
          deletedAt: null,
          platformCreatedAt: { gte: from, lte: to },
          status: { notIn: COMPLETED_ORDER_STATUSES },
        },
        select: {
          platformCreatedAt: true,
          totalAmount: true,
        },
      });

      const buckets = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        revenue: 0,
        orderCount: 0,
      }));

      for (const order of orders) {
        const hour = order.platformCreatedAt.getHours();
        const bucket = buckets[hour];
        if (bucket) {
          bucket.orderCount++;
          bucket.revenue += Number(order.totalAmount);
        }
      }

      const hours = buckets.map((b) => ({
        ...b,
        revenue: Math.round(b.revenue * 100) / 100,
      }));

      return { days: safeDays, hours };
    });
  }

  async getTopProducts(
    organizationId: string,
    period: string | undefined,
    limit: number | undefined,
  ): Promise<TopProductsResponse> {
    const periodDays = parsePeriodDays(period, 30);
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 50);
    const { from, to } = rangeForDays(periodDays);

    const items = await this.prisma.orderItem.findMany({
      where: {
        organizationId,
        order: {
          deletedAt: null,
          platformCreatedAt: { gte: from, lte: to },
          status: { notIn: COMPLETED_ORDER_STATUSES },
        },
      },
      select: {
        barcode: true,
        productName: true,
        quantity: true,
        unitPrice: true,
      },
    });

    const byBarcode = new Map<
      string,
      {
        productName: string | null;
        quantity: number;
        revenue: number;
        orderCount: number;
      }
    >();

    for (const item of items) {
      const existing = byBarcode.get(item.barcode) ?? {
        productName: item.productName,
        quantity: 0,
        revenue: 0,
        orderCount: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * Number(item.unitPrice);
      existing.orderCount++;
      if (!existing.productName && item.productName) {
        existing.productName = item.productName;
      }
      byBarcode.set(item.barcode, existing);
    }

    const products = Array.from(byBarcode.entries())
      .map(([barcode, stats]) => ({
        barcode,
        productName: stats.productName,
        quantity: stats.quantity,
        revenue: Math.round(stats.revenue * 100) / 100,
        orderCount: stats.orderCount,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, safeLimit);

    return { periodDays, products };
  }

  async getTopReturnedProducts(
    organizationId: string,
    period: string | undefined,
    limit: number | undefined,
  ): Promise<TopReturnedProductsResponse> {
    const periodDays = parsePeriodDays(period, 30);
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 50);
    const { from, to } = rangeForDays(periodDays);

    const items = await this.prisma.returnItem.findMany({
      where: {
        return: {
          organizationId,
          deletedAt: null,
          requestedAt: { gte: from, lte: to },
        },
      },
      select: {
        barcode: true,
        quantity: true,
        returnId: true,
      },
    });

    const byBarcode = new Map<
      string,
      { quantity: number; returnIds: Set<string> }
    >();

    for (const item of items) {
      const existing = byBarcode.get(item.barcode) ?? {
        quantity: 0,
        returnIds: new Set<string>(),
      };
      existing.quantity += item.quantity;
      existing.returnIds.add(item.returnId);
      byBarcode.set(item.barcode, existing);
    }

    const products = Array.from(byBarcode.entries())
      .map(([barcode, stats]) => ({
        barcode,
        returnCount: stats.returnIds.size,
        quantity: stats.quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, safeLimit);

    return { periodDays, products };
  }

  async getAovTrend(
    organizationId: string,
    days: number | undefined,
  ): Promise<AovTrendResponse> {
    const safeDays = Math.min(Math.max(days ?? 90, 1), 365);
    const { from, to } = rangeForDays(safeDays);
    const cacheKey = CacheService.key(
      'analytics',
      'aov-trend',
      organizationId,
      String(safeDays),
    );

    return readThroughCache(this.cache, cacheKey, 300, async () => {
      const rows = await this.reports.getSalesReport(
        organizationId,
        from,
        to,
        'day',
      );
      const rowMap = new Map(rows.map((r) => [r.period.slice(0, 10), r]));

      const points = dayKeys(safeDays).map(({ iso, label }) => {
        const row = rowMap.get(iso);
        const orderCount = row?.totalOrders ?? 0;
        const revenue = row?.totalRevenue ?? 0;
        const aov =
          orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0;
        return {
          date: iso,
          label,
          aov,
          orderCount,
          revenue: Math.round(revenue * 100) / 100,
        };
      });

      return { days: safeDays, points };
    });
  }

  async getDailyRevenueTrend(
    organizationId: string,
    days: number | undefined,
  ): Promise<DailyRevenueTrendResponse> {
    const safeDays = Math.min(Math.max(days ?? 30, 1), 365);
    const { from, to } = rangeForDays(safeDays);
    const rows = await this.reports.getSalesReport(
      organizationId,
      from,
      to,
      'day',
    );
    const rowMap = new Map(rows.map((r) => [r.period.slice(0, 10), r]));

    const points = dayKeys(safeDays).map(({ iso, label }) => {
      const row = rowMap.get(iso);
      return {
        date: iso,
        label,
        revenue: Math.round((row?.totalRevenue ?? 0) * 100) / 100,
        orderCount: row?.totalOrders ?? 0,
      };
    });

    return { days: safeDays, points };
  }
}
