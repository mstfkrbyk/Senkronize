import { Injectable } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';

import { readThroughCache } from '../common/cache/cache.decorator';
import { CacheKeys } from '../common/cache/cache-keys';
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
  rangeWithYearAgo,
} from './analytics-period.util';
import type {
  AnalyticsCategoryComparisonRow,
  AnalyticsComparisonResponse,
  AnalyticsComparisonSummary,
  AnalyticsPlatformComparisonRow,
  AovTrendResponse,
  ComparisonMetricTriple,
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

function comparisonTriple(
  current: number,
  previous: number,
  yearAgo: number,
): ComparisonMetricTriple {
  return {
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    yearAgo: Math.round(yearAgo * 100) / 100,
    changeVsPrevious: pctDelta(current, previous),
    changeVsYearAgo: pctDelta(current, yearAgo),
  };
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
    const cacheKey = `${CacheKeys.platformStats(organizationId)}:${String(periodDays)}`;

    return this.cache.readThrough(cacheKey, 300, async () => {
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

  async getComparison(
    organizationId: string,
    period: string | undefined,
  ): Promise<AnalyticsComparisonResponse> {
    const periodDays = parsePeriodDays(period, 30);
    const { current, previous, yearAgo } = rangeWithYearAgo(periodDays);

    const orderWhere = (
      from: Date,
      to: Date,
    ): Prisma.OrderWhereInput => ({
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: from, lte: to },
      status: { notIn: COMPLETED_ORDER_STATUSES },
    });

    const [
      revCurrent,
      revPrev,
      revYear,
      ordCurrent,
      ordPrev,
      ordYear,
      platformCurrent,
      platformPrev,
      platformYear,
      categoryCurrent,
      categoryPrev,
      categoryYear,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: orderWhere(current.from, current.to),
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: orderWhere(previous.from, previous.to),
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: orderWhere(yearAgo.from, yearAgo.to),
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: orderWhere(current.from, current.to),
      }),
      this.prisma.order.count({
        where: orderWhere(previous.from, previous.to),
      }),
      this.prisma.order.count({
        where: orderWhere(yearAgo.from, yearAgo.to),
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: orderWhere(current.from, current.to),
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: orderWhere(previous.from, previous.to),
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: orderWhere(yearAgo.from, yearAgo.to),
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.fetchCategoryStats(organizationId, current.from, current.to),
      this.fetchCategoryStats(organizationId, previous.from, previous.to),
      this.fetchCategoryStats(organizationId, yearAgo.from, yearAgo.to),
    ]);

    const revenueCurrent = Number(revCurrent._sum.totalAmount ?? 0);
    const revenuePrev = Number(revPrev._sum.totalAmount ?? 0);
    const revenueYear = Number(revYear._sum.totalAmount ?? 0);

    const summary: AnalyticsComparisonSummary = {
      revenue: comparisonTriple(revenueCurrent, revenuePrev, revenueYear),
      orders: comparisonTriple(ordCurrent, ordPrev, ordYear),
      avgOrderValue: comparisonTriple(
        ordCurrent > 0 ? revenueCurrent / ordCurrent : 0,
        ordPrev > 0 ? revenuePrev / ordPrev : 0,
        ordYear > 0 ? revenueYear / ordYear : 0,
      ),
    };

    const platformMap = (
      rows: typeof platformCurrent,
    ): Map<Marketplace, { orders: number; revenue: number }> =>
      new Map(
        rows.map(
          (r) =>
            [
              r.platform,
              {
                orders: r._count._all,
                revenue: Number(r._sum.totalAmount ?? 0),
              },
            ] as const,
        ),
      );

    const curP = platformMap(platformCurrent);
    const prevP = platformMap(platformPrev);
    const yearP = platformMap(platformYear);
    const platformSet = new Set<Marketplace>([
      ...curP.keys(),
      ...prevP.keys(),
      ...yearP.keys(),
    ]);

    const platforms: AnalyticsPlatformComparisonRow[] = Array.from(platformSet)
      .sort((a, b) => a.localeCompare(b))
      .map((platform) => {
        const c = curP.get(platform);
        const p = prevP.get(platform);
        const y = yearP.get(platform);
        return {
          platform,
          label: MARKETPLACE_LABEL_TR[platform] ?? platform,
          revenue: comparisonTriple(
            c?.revenue ?? 0,
            p?.revenue ?? 0,
            y?.revenue ?? 0,
          ),
          orders: comparisonTriple(
            c?.orders ?? 0,
            p?.orders ?? 0,
            y?.orders ?? 0,
          ),
        };
      })
      .sort(
        (a, b) => b.revenue.current - a.revenue.current,
      );

    const categoryKeys = new Set([
      ...categoryCurrent.keys(),
      ...categoryPrev.keys(),
      ...categoryYear.keys(),
    ]);

    const categories: AnalyticsCategoryComparisonRow[] = Array.from(
      categoryKeys,
    )
      .map((key) => {
        const cur = categoryCurrent.get(key);
        const prev = categoryPrev.get(key);
        const year = categoryYear.get(key);
        return {
          categoryId: cur?.categoryId ?? prev?.categoryId ?? year?.categoryId ?? null,
          categoryName:
            cur?.name ?? prev?.name ?? year?.name ?? 'Kategorisiz',
          revenue: comparisonTriple(
            cur?.revenue ?? 0,
            prev?.revenue ?? 0,
            year?.revenue ?? 0,
          ),
          orders: comparisonTriple(
            cur?.orders ?? 0,
            prev?.orders ?? 0,
            year?.orders ?? 0,
          ),
        };
      })
      .sort((a, b) => b.revenue.current - a.revenue.current)
      .slice(0, 20);

    return { periodDays, summary, platforms, categories };
  }

  private async fetchCategoryStats(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<
    Map<
      string,
      { categoryId: string | null; name: string; revenue: number; orders: number }
    >
  > {
    const items = await this.prisma.orderItem.findMany({
      where: {
        organizationId,
        order: {
          organizationId,
          deletedAt: null,
          platformCreatedAt: { gte: from, lte: to },
          status: { notIn: COMPLETED_ORDER_STATUSES },
        },
      },
      select: { quantity: true, unitPrice: true, barcode: true },
    });

    if (items.length === 0) {
      return new Map();
    }

    const barcodes = [...new Set(items.map((i) => i.barcode))];
    const products = await this.prisma.product.findMany({
      where: { organizationId, deletedAt: null, barcode: { in: barcodes } },
      select: {
        barcode: true,
        categoryId: true,
        category: true,
        productCategory: { select: { id: true, name: true } },
      },
    });
    const productMeta = new Map(products.map((p) => [p.barcode, p] as const));

    const stats = new Map<
      string,
      { categoryId: string | null; name: string; revenue: number; orders: number }
    >();

    for (const item of items) {
      const meta = productMeta.get(item.barcode);
      const key = meta?.categoryId ?? meta?.category ?? 'uncategorized';
      const name =
        meta?.productCategory?.name ?? meta?.category ?? 'Kategorisiz';
      const entry = stats.get(key) ?? {
        categoryId: meta?.categoryId ?? null,
        name,
        revenue: 0,
        orders: 0,
      };
      entry.revenue += item.quantity * Number(item.unitPrice);
      entry.orders += 1;
      stats.set(key, entry);
    }

    return stats;
  }
}
