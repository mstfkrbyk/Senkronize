import { Injectable } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';

import { readThroughCache } from '../common/cache/cache.decorator';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  DashboardSummaryDto,
  OrderTrendDto,
  PlatformComparisonDto,
  PlatformComparisonRowDto,
  PlatformReportRow,
  ProfitReportDto,
  SalesReportRow,
  StockMovementRow,
  StockValueReportDto,
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

const MARKETPLACE_LABEL_TR: Record<Marketplace, string> = {
  [Marketplace.TRENDYOL]: 'Trendyol',
  [Marketplace.HEPSIBURADA]: 'Hepsiburada',
  [Marketplace.N11]: 'n11',
  [Marketplace.AMAZON_TR]: 'Amazon TR',
  [Marketplace.CICEKSEPETI]: 'Çiçeksepeti',
  [Marketplace.IDEASOFT]: 'Ideasoft',
  [Marketplace.PTTAVM]: 'PttAVM',
  [Marketplace.PAZARAMA]: 'Pazarama',
  [Marketplace.TSOFT]: 'T-Soft',
  [Marketplace.TICIMAX]: 'Ticimax',
  [Marketplace.WOOCOMMERCE]: 'WooCommerce',
  [Marketplace.SHOPIFY]: 'Shopify',
  [Marketplace.GETIR]: 'Getir',
  [Marketplace.GRATIS]: 'Gratis',
  [Marketplace.BOYNER]: 'Boyner',
  [Marketplace.MORHIPO]: 'Morhipo',
  [Marketplace.DOLAP]: 'Dolap',
  [Marketplace.EBAY]: 'eBay',
  [Marketplace.ETSY]: 'Etsy',
  [Marketplace.TEMU]: 'Temu',
  [Marketplace.SAHIBINDEN]: 'Sahibinden',
  [Marketplace.MIGROS]: 'Migros Sanal Market',
  [Marketplace.HEPSIEXPRESS]: 'Hepsiexpress',
  [Marketplace.FLO]: 'Flo',
  [Marketplace.DEFACTO]: 'Defacto',
  [Marketplace.LCWAIKIKI]: 'LC Waikiki',
  [Marketplace.VATAN]: 'Vatan Bilgisayar',
  [Marketplace.MEDIAMARKT]: 'MediaMarkt TR',
  [Marketplace.TEKNOSA]: 'Teknosa',
  [Marketplace.KOTON]: 'Koton',
  [Marketplace.MAVI]: 'Mavi',
  [Marketplace.ALLEGRO]: 'Allegro',
  [Marketplace.WILDBERRIES]: 'Wildberries',
  [Marketplace.OZON]: 'Ozon',
  [Marketplace.NOON]: 'Noon',
  [Marketplace.AMAZON_EU]: 'Amazon EU',
  [Marketplace.CDISCOUNT]: 'Cdiscount',
  [Marketplace.KAUFLAND]: 'Kaufland',
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getDashboardSummary(
    organizationId: string,
    period: 'default' | '24h' | '7d' | 'month' | undefined,
  ): Promise<DashboardSummaryDto> {
    const p = period ?? 'default';
    const cacheKey = CacheService.key('dashboard', organizationId, p);
    return readThroughCache(this.cache, cacheKey, 120, async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const orderBase: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
    };

    const now = new Date();

    let windowStart = startOfToday;
    let windowEnd = now;
    let prevWindowStart = startOfYesterday;
    let prevWindowEnd = startOfToday;

    if (p === '24h') {
      windowEnd = now;
      windowStart = new Date(now.getTime() - 86_400_000);
      prevWindowEnd = windowStart;
      prevWindowStart = new Date(windowStart.getTime() - 86_400_000);
    } else if (p === '7d') {
      windowEnd = now;
      windowStart = new Date(now.getTime() - 7 * 86_400_000);
      prevWindowEnd = windowStart;
      prevWindowStart = new Date(windowStart.getTime() - 7 * 86_400_000);
    } else if (p === 'month') {
      windowEnd = now;
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lenMs = Math.max(86_400_000, windowEnd.getTime() - windowStart.getTime());
      prevWindowEnd = new Date(windowStart.getTime());
      prevWindowStart = new Date(windowStart.getTime() - lenMs);
    }

    const [
      todayOrders,
      yesterdayOrders,
      pendingOrders,
      totalProducts,
      activeConnections,
      totalConnections,
      lowStockCount,
      windowOrders,
      windowOrdersPrev,
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
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: {
            gte: prevWindowStart,
            lt: prevWindowEnd,
          },
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

    let windowOrdersDeltaPct = 0;
    if (windowOrdersPrev === 0) {
      windowOrdersDeltaPct = windowOrders > 0 ? 100 : 0;
    } else {
      windowOrdersDeltaPct = Math.round(
        ((windowOrders - windowOrdersPrev) / windowOrdersPrev) * 100,
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
      windowOrders,
      windowOrdersPrev,
      windowOrdersDeltaPct,
    };
    });
  }

  async getSalesReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<SalesReportRow[]> {
    const cacheKey = CacheService.key(
      'reports',
      'sales',
      organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
      groupBy,
    );
    const cached = await this.cache.get<SalesReportRow[]>(cacheKey);
    if (cached) {
      return cached;
    }

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

    const rows = Array.from(grouped.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
    await this.cache.set(cacheKey, rows, 300);
    return rows;
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

  async getProfitReport(
    organizationId: string,
    params: { from: Date; to: Date; platform?: Marketplace },
  ): Promise<ProfitReportDto> {
    const cacheKey = CacheService.key(
      'reports',
      'profit',
      organizationId,
      params.from.toISOString(),
      params.to.toISOString(),
      params.platform ?? 'all',
    );
    return readThroughCache(this.cache, cacheKey, 1800, async () => {
    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: params.from, lte: params.to },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      ...(params.platform ? { platform: params.platform } : {}),
    };

    const [revenueAgg, byPlatformRows, orderItems] = await Promise.all([
      this.prisma.order.aggregate({
        where: orderWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          organizationId,
          order: orderWhere,
        },
        select: {
          barcode: true,
          productName: true,
          quantity: true,
          unitPrice: true,
        },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const estimatedProfit = totalRevenue * 0.2;
    const profitMargin =
      totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0;

    const byPlatform = byPlatformRows.map((r) => ({
      platform: r.platform,
      revenue: Number(r._sum.totalAmount ?? 0),
      orderCount: r._count._all,
    }));

    const aggByBarcode = new Map<
      string,
      { revenue: number; quantity: number; nameHint: string | null }
    >();
    for (const it of orderItems) {
      const lineRevenue = Number(it.unitPrice) * it.quantity;
      const prev = aggByBarcode.get(it.barcode);
      const nameHint =
        it.productName && it.productName.trim().length > 0
          ? it.productName.trim()
          : null;
      if (!prev) {
        aggByBarcode.set(it.barcode, {
          revenue: lineRevenue,
          quantity: it.quantity,
          nameHint,
        });
      } else {
        prev.revenue += lineRevenue;
        prev.quantity += it.quantity;
        if (!prev.nameHint && nameHint) {
          prev.nameHint = nameHint;
        }
      }
    }

    const sortedBarcodes = Array.from(aggByBarcode.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([b]) => b);

    const products =
      sortedBarcodes.length > 0
        ? await this.prisma.product.findMany({
            where: {
              organizationId,
              deletedAt: null,
              barcode: { in: sortedBarcodes },
            },
            select: { barcode: true, name: true },
          })
        : [];
    const productNameByBarcode = new Map(
      products.map((p) => [p.barcode, p.name] as const),
    );

    const topProducts = sortedBarcodes.map((barcode) => {
      const row = aggByBarcode.get(barcode)!;
      const fromProduct = productNameByBarcode.get(barcode);
      const name =
        row.nameHint ?? fromProduct ?? barcode;
      return {
        name,
        barcode,
        revenue: row.revenue,
        quantity: row.quantity,
      };
    });

    return {
      totalRevenue,
      estimatedProfit,
      profitMargin,
      byPlatform,
      topProducts,
    };
    });
  }

  async getStockValueReport(
    organizationId: string,
  ): Promise<StockValueReportDto> {
    const cacheKey = CacheService.key(
      'reports',
      'stock-value',
      organizationId,
      'current',
    );
    return readThroughCache(this.cache, cacheKey, 900, async () => {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        platform: true,
        barcode: true,
        salePrice: true,
        quantity: true,
      },
    });

    let totalStockValue = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const distinctProducts = new Set<string>();
    const byPlatform = new Map<
      Marketplace,
      { totalValue: number; skuCount: number }
    >();

    for (const L of listings) {
      distinctProducts.add(L.barcode);
      const price = Number(L.salePrice);
      const value = price * L.quantity;
      totalStockValue += value;

      if (L.quantity === 0) {
        outOfStockCount++;
      } else if (L.quantity <= 5) {
        lowStockCount++;
      }

      const cur = byPlatform.get(L.platform) ?? { totalValue: 0, skuCount: 0 };
      cur.totalValue += value;
      cur.skuCount++;
      byPlatform.set(L.platform, cur);
    }

    return {
      totalProducts: distinctProducts.size,
      totalSkus: listings.length,
      totalStockValue,
      outOfStockCount,
      lowStockCount,
      byPlatform: Array.from(byPlatform.entries()).map(([platform, v]) => ({
        platform,
        totalValue: v.totalValue,
        skuCount: v.skuCount,
      })),
    };
    });
  }

  async getOrderTrend(
    organizationId: string,
    params: {
      granularity: 'daily' | 'weekly' | 'monthly';
      from: Date;
      to: Date;
    },
  ): Promise<OrderTrendDto> {
    const cacheKey = CacheService.key(
      'reports',
      'order-trend',
      organizationId,
      params.granularity,
      params.from.toISOString(),
      params.to.toISOString(),
    );
    return readThroughCache(this.cache, cacheKey, 600, async () => {
    const groupBy =
      params.granularity === 'daily'
        ? 'day'
        : params.granularity === 'weekly'
          ? 'week'
          : 'month';
    const rows = await this.getSalesReport(
      organizationId,
      params.from,
      params.to,
      groupBy,
    );
    return {
      labels: rows.map((r) => r.period),
      orderCounts: rows.map((r) => r.totalOrders),
      revenues: rows.map((r) => r.totalRevenue),
    };
    });
  }

  async getPlatformComparison(
    organizationId: string,
    params: { from: Date; to: Date },
  ): Promise<PlatformComparisonDto> {
    const cacheKey = CacheService.key(
      'reports',
      'platform-comparison',
      organizationId,
      params.from.toISOString(),
      params.to.toISOString(),
    );
    return readThroughCache(this.cache, cacheKey, 1800, async () => {
    const baseWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: params.from, lte: params.to },
    };

    const [goodRows, totalRows, badRows, connections] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['platform'],
        where: {
          ...baseWhere,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: {
          ...baseWhere,
          status: { in: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
        _count: { _all: true },
      }),
      this.prisma.marketplaceConnection.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          platform: true,
          isActive: true,
          lastSyncAt: true,
          syncErrorCount: true,
        },
      }),
    ]);

    const goodMap = new Map(
      goodRows.map((r) => [
        r.platform,
        {
          orderCount: r._count._all,
          revenue: Number(r._sum.totalAmount ?? 0),
        },
      ] as const),
    );
    const totalMap = new Map(
      totalRows.map((r) => [r.platform, r._count._all] as const),
    );
    const badMap = new Map(
      badRows.map((r) => [r.platform, r._count._all] as const),
    );

    const platformSet = new Set<Marketplace>();
    for (const c of connections) {
      platformSet.add(c.platform);
    }
    for (const p of totalMap.keys()) {
      platformSet.add(p);
    }
    for (const p of goodMap.keys()) {
      platformSet.add(p);
    }

    const connByPlatform = new Map(
      connections.map((c) => [c.platform, c] as const),
    );

    const platforms: PlatformComparisonRowDto[] = Array.from(platformSet)
      .sort((a, b) => a.localeCompare(b))
      .map((platform) => {
        const good = goodMap.get(platform);
        const orderCount = good?.orderCount ?? 0;
        const revenue = good?.revenue ?? 0;
        const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
        const totalOrders = totalMap.get(platform) ?? 0;
        const badOrders = badMap.get(platform) ?? 0;
        const returnRate =
          totalOrders > 0 ? (badOrders / totalOrders) * 100 : 0;
        return {
          name: MARKETPLACE_LABEL_TR[platform] ?? platform,
          orderCount,
          revenue,
          avgOrderValue,
          returnRate,
          syncStatus: this.describeConnectionSync(
            connByPlatform.get(platform),
          ),
        };
      });

    return { platforms };
    });
  }

  private describeConnectionSync(
    connection:
      | {
          isActive: boolean;
          lastSyncAt: Date | null;
          syncErrorCount: number;
        }
      | undefined,
  ): string {
    if (!connection) {
      return 'Bağlantı yok';
    }
    if (!connection.isActive) {
      return 'Pasif';
    }
    if (connection.syncErrorCount > 0) {
      return 'Senkron hatası';
    }
    if (!connection.lastSyncAt) {
      return 'Henüz senkron yok';
    }
    const hours =
      (Date.now() - connection.lastSyncAt.getTime()) / (60 * 60 * 1000);
    if (hours > 48) {
      return 'Senkron gecikti';
    }
    return 'Güncel';
  }
}
