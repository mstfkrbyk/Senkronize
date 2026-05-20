import { Injectable } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';

import { BuyBoxService } from '../pricing/buybox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MARKETPLACE_LABEL_TR,
  ReportsService,
} from '../reports/reports.service';
import { UsersService } from '../users/users.service';

import {
  dashboardCurrentRange,
  dashboardPeriodDays,
  dashboardRanges,
  pctChangeRounded,
  type DashboardPeriod,
} from './dashboard-period.util';
import { DEFAULT_DASHBOARD_WIDGETS } from './dashboard-widget.defaults';
import type {
  DashboardActivityFeedItem,
  DashboardActivityItem,
  DashboardKpisResponse,
  DashboardOrdersTrendPoint,
  DashboardOrdersTrendResponse,
  DashboardPlatformDistributionResponse,
  DashboardPlatformPerformanceRow,
  DashboardPlatformSlice,
  DashboardRevenueTrendPoint,
  DashboardSummaryResponse,
  DashboardTopProductRow,
  DashboardWidgetConfig,
  DashboardWidgetsResponse,
  KpiMetricBlock,
} from './dashboard.types';

function dayKeys(days: number): { iso: string; label: string }[] {
  const res: { iso: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0] ?? '';
    res.push({
      iso,
      label: d.toLocaleDateString('tr-TR', {
        weekday: days <= 7 ? 'short' : undefined,
        day: 'numeric',
        month: days > 7 ? 'short' : undefined,
      }),
    });
  }
  return res;
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function auditActionDescription(
  action: string,
  resource: string,
  metadata: Record<string, unknown>,
): string {
  const platform =
    typeof metadata.platform === 'string' ? metadata.platform : '';
  const platformSuffix = platform.length > 0 ? ` (${platform})` : '';

  const map: Record<string, string> = {
    'partner.impersonation_start': 'Partner müşteri hesabına geçiş yaptı',
    'partner.impersonation_end': 'Partner impersonation sonlandı',
    'subscription.plan_changed': 'Abonelik planı değiştirildi',
    'sync_completed': `Senkronizasyon tamamlandı${platformSuffix}`,
    'sync_failed': `Senkronizasyon hatası${platformSuffix}`,
    'queue.job_failed': 'Kuyruk işi başarısız',
    'user.role_changed': 'Kullanıcı rolü güncellendi',
    'listing.updated': 'Listeleme güncellendi',
    'order.status_changed': 'Sipariş durumu değişti',
  };
  if (map[action]) {
    return map[action];
  }
  if (action.startsWith('sync_')) {
    return `Senkronizasyon: ${action.replace(/^sync_/, '')}${platformSuffix}`;
  }
  return `${action} — ${resource}`;
}

const GOOD_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
];

function kpiBlock(current: number, previous: number): KpiMetricBlock {
  return {
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    change: pctChangeRounded(current, previous),
  };
}

function parseWidgetsJson(raw: unknown): DashboardWidgetConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_DASHBOARD_WIDGETS;
  }
  const parsed: DashboardWidgetConfig[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const type = typeof row.type === 'string' ? row.type : '';
    const size =
      row.size === '2x1' || row.size === '2x2' || row.size === '1x1'
        ? row.size
        : '1x1';
    const position = typeof row.position === 'number' ? row.position : 0;
    const visible =
      typeof row.visible === 'boolean' ? row.visible : true;
    if (id.length === 0 || type.length === 0) {
      continue;
    }
    parsed.push({ id, type, size, position, visible });
  }
  return parsed.length > 0 ? parsed : DEFAULT_DASHBOARD_WIDGETS;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly reports: ReportsService,
    private readonly buyBox: BuyBoxService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(
    organizationId: string,
    period: 'default' | '24h' | '7d' | 'month' | undefined,
  ): Promise<DashboardSummaryResponse> {
    const p = period ?? 'default';
    const dash = await this.reports.getDashboardSummary(organizationId, p);

    const now = new Date();
    let windowStart = new Date(now);
    windowStart.setHours(0, 0, 0, 0);
    let prevStart = new Date(windowStart);
    prevStart.setDate(prevStart.getDate() - 1);

    if (p === '24h') {
      windowStart = new Date(now.getTime() - 86_400_000);
      prevStart = new Date(windowStart.getTime() - 86_400_000);
    } else if (p === '7d') {
      windowStart = new Date(now.getTime() - 7 * 86_400_000);
      prevStart = new Date(windowStart.getTime() - 7 * 86_400_000);
    } else if (p === 'month') {
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lenMs = Math.max(86_400_000, now.getTime() - windowStart.getTime());
      prevStart = new Date(windowStart.getTime() - lenMs);
    }

    const prevEnd = new Date(windowStart.getTime());

    const [salesCurrent, salesPrev, buyboxCurrent, buyboxPrev] =
      await Promise.all([
        this.reports.getSalesReport(organizationId, windowStart, now, 'day'),
        this.reports.getSalesReport(
          organizationId,
          prevStart,
          prevEnd,
          'day',
        ),
        this.buyBox.getBuyBoxWinRate(organizationId, 7),
        this.buyBox.getBuyBoxWinRate(organizationId, 14),
      ]);

    const revenueTry = salesCurrent.reduce((s, r) => s + r.totalRevenue, 0);
    const revenuePrev = salesPrev.reduce((s, r) => s + r.totalRevenue, 0);
    const revenueDeltaPct = pctDelta(revenueTry, revenuePrev);

    const buyboxWinRatePct = Math.round(buyboxCurrent.winRate * 1000) / 10;
    const prevRatePct = Math.round(buyboxPrev.winRate * 1000) / 10;
    const buyboxWinRateDeltaPct = pctDelta(buyboxWinRatePct, prevRatePct);

    const ordersCount =
      p === 'default' ? dash.todayOrders : dash.windowOrders;
    const ordersDelta =
      p === 'default' ? dash.todayOrdersDelta : dash.windowOrdersDeltaPct;

    return {
      todayOrders: ordersCount,
      todayOrdersDelta: ordersDelta,
      windowOrders: dash.windowOrders,
      windowOrdersDeltaPct: dash.windowOrdersDeltaPct,
      revenueTry,
      revenueDeltaPct,
      lowStockCount: dash.lowStockCount,
      buyboxWinRatePct,
      buyboxWinRateDeltaPct,
      pendingOrders: dash.pendingOrders,
      totalConnections: dash.totalConnections,
      activeConnections: dash.activeConnections,
    };
  }

  async getKpis(
    organizationId: string,
    period: DashboardPeriod,
  ): Promise<DashboardKpisResponse> {
    const { current, previous } = dashboardRanges(period);
    const days = dashboardPeriodDays(period);

    const orderWhere = (
      from: Date,
      to: Date,
    ): Prisma.OrderWhereInput => ({
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: from, lte: to },
      status: { notIn: GOOD_ORDER_STATUSES },
    });

    const [
      revenueCurrentAgg,
      revenuePrevAgg,
      ordersCurrent,
      ordersPrev,
      listingsCurrent,
      listingsPrev,
      lowStockProducts,
      pendingOrders,
      buyboxStats,
      dash,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: orderWhere(current.from, current.to),
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: orderWhere(previous.from, previous.to),
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: orderWhere(current.from, current.to),
      }),
      this.prisma.order.count({
        where: orderWhere(previous.from, previous.to),
      }),
      this.prisma.listing.count({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
          quantity: { gt: 0 },
        },
      }),
      this.prisma.listing.count({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
          createdAt: { lte: previous.to },
        },
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
          organizationId,
          deletedAt: null,
          status: {
            in: [
              OrderStatus.NEW,
              OrderStatus.PICKING,
              OrderStatus.INVOICED,
            ],
          },
        },
      }),
      this.buyBox.getBuyBoxWinRate(organizationId, days),
      this.reports.getDashboardSummary(organizationId, 'default'),
    ]);

    const revenueCurrent = Number(revenueCurrentAgg._sum.totalAmount ?? 0);
    const revenuePrev = Number(revenuePrevAgg._sum.totalAmount ?? 0);
    const aovCurrent =
      ordersCurrent > 0 ? revenueCurrent / ordersCurrent : 0;
    const aovPrev = ordersPrev > 0 ? revenuePrev / ordersPrev : 0;

    return {
      revenue: kpiBlock(revenueCurrent, revenuePrev),
      orders: kpiBlock(ordersCurrent, ordersPrev),
      avgOrderValue: kpiBlock(aovCurrent, aovPrev),
      activeListings: kpiBlock(listingsCurrent, listingsPrev),
      lowStockProducts: lowStockProducts,
      pendingOrders: dash.pendingOrders ?? pendingOrders,
      buyboxWinRate: Math.round(buyboxStats.winRate * 1000) / 10,
    };
  }

  async getPlatformPerformance(
    organizationId: string,
    period: DashboardPeriod,
  ): Promise<DashboardPlatformPerformanceRow[]> {
    const { from, to } = dashboardCurrentRange(period);
    const rows = await this.reports.getPlatformReport(
      organizationId,
      from,
      to,
    );
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

    return rows
      .map((row) => ({
        platform: row.platform,
        orders: row.orderCount,
        revenue: Math.round(row.revenue * 100) / 100,
        share:
          totalRevenue > 0
            ? Math.round((row.revenue / totalRevenue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getRevenueTrend(
    organizationId: string,
    period: DashboardPeriod,
    groupBy: 'day' | 'week' | 'month',
  ): Promise<DashboardRevenueTrendPoint[]> {
    const days = dashboardPeriodDays(period);
    const { from, to } = dashboardCurrentRange(period);
    const rows = await this.reports.getSalesReport(
      organizationId,
      from,
      to,
      groupBy,
    );

    if (groupBy === 'day') {
      const periodMap = new Map(
        rows.map((r) => [r.period.slice(0, 10), r]),
      );
      return dayKeys(days).map(({ iso }) => {
        const row = periodMap.get(iso);
        return {
          date: iso,
          revenue: Math.round((row?.totalRevenue ?? 0) * 100) / 100,
          orders: row?.totalOrders ?? 0,
        };
      });
    }

    return rows.map((row) => ({
      date: row.period.slice(0, 10),
      revenue: Math.round(row.totalRevenue * 100) / 100,
      orders: row.totalOrders,
    }));
  }

  async getTopProducts(
    organizationId: string,
    period: DashboardPeriod,
    limit: number,
  ): Promise<DashboardTopProductRow[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const { from, to } = dashboardCurrentRange(period);

    const items = await this.prisma.orderItem.findMany({
      where: {
        organizationId,
        order: {
          deletedAt: null,
          platformCreatedAt: { gte: from, lte: to },
          status: { notIn: GOOD_ORDER_STATUSES },
        },
      },
      select: {
        barcode: true,
        productName: true,
        quantity: true,
        unitPrice: true,
        order: { select: { platform: true } },
      },
    });

    const byBarcode = new Map<
      string,
      {
        name: string;
        sales: number;
        revenue: number;
        platforms: Set<string>;
      }
    >();

    for (const item of items) {
      const existing = byBarcode.get(item.barcode) ?? {
        name: item.productName ?? item.barcode,
        sales: 0,
        revenue: 0,
        platforms: new Set<string>(),
      };
      existing.sales += item.quantity;
      existing.revenue += item.quantity * Number(item.unitPrice);
      existing.platforms.add(String(item.order.platform));
      if (item.productName) {
        existing.name = item.productName;
      }
      byBarcode.set(item.barcode, existing);
    }

    const barcodes = Array.from(byBarcode.keys()).slice(0, safeLimit * 3);
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        barcode: { in: barcodes },
      },
      select: { id: true, barcode: true, name: true, sku: true },
    });
    const productByBarcode = new Map(
      products.map((p) => [p.barcode, p] as const),
    );

    return Array.from(byBarcode.entries())
      .map(([barcode, stats]) => {
        const product = productByBarcode.get(barcode);
        return {
          productId: product?.id ?? null,
          name: product?.name ?? stats.name,
          sku: product?.sku ?? null,
          sales: stats.sales,
          revenue: Math.round(stats.revenue * 100) / 100,
          platforms: Array.from(stats.platforms).sort(),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, safeLimit);
  }

  async getMixedActivity(
    organizationId: string,
    limit: number,
  ): Promise<DashboardActivityFeedItem[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const perSource = Math.ceil(safeLimit / 3);

    const [orders, lowStock, syncLogs] = await Promise.all([
      this.prisma.order.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { platformCreatedAt: 'desc' },
        take: perSource,
        select: {
          id: true,
          platformOrderId: true,
          platform: true,
          customerName: true,
          totalAmount: true,
          status: true,
          platformCreatedAt: true,
        },
      }),
      this.prisma.listing.findMany({
        where: {
          organizationId,
          deletedAt: null,
          quantity: { gt: 0, lte: 5 },
        },
        orderBy: { updatedAt: 'desc' },
        take: perSource,
        select: {
          id: true,
          title: true,
          barcode: true,
          quantity: true,
          platform: true,
          updatedAt: true,
        },
      }),
      this.prisma.syncLog.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: perSource,
        select: {
          id: true,
          platform: true,
          status: true,
          startedAt: true,
          completedAt: true,
          itemsProcessed: true,
        },
      }),
    ]);

    const feed: DashboardActivityFeedItem[] = [];

    for (const order of orders) {
      feed.push({
        id: `order-${order.id}`,
        kind: 'order',
        title: 'Yeni sipariş',
        description: `${MARKETPLACE_LABEL_TR[order.platform as Marketplace] ?? order.platform} — ${order.customerName} · ${order.platformOrderId}`,
        createdAt: order.platformCreatedAt.toISOString(),
        metadata: {
          orderId: order.id,
          platform: String(order.platform),
          status: order.status,
          amount: Number(order.totalAmount),
        },
      });
    }

    for (const listing of lowStock) {
      feed.push({
        id: `stock-${listing.id}`,
        kind: 'stock_alert',
        title: 'Düşük stok',
        description: `${listing.title} — ${String(listing.quantity)} adet kaldı`,
        createdAt: listing.updatedAt.toISOString(),
        metadata: {
          barcode: listing.barcode,
          platform: String(listing.platform),
          quantity: listing.quantity,
        },
      });
    }

    for (const log of syncLogs) {
      const label =
        MARKETPLACE_LABEL_TR[log.platform as Marketplace] ?? log.platform;
      feed.push({
        id: `sync-${log.id}`,
        kind: 'sync',
        title: log.status === 'FAILED' ? 'Senkronizasyon hatası' : 'Senkronizasyon',
        description: `${label} — ${String(log.itemsProcessed)} kayıt işlendi`,
        createdAt: (log.completedAt ?? log.startedAt).toISOString(),
        metadata: {
          platform: String(log.platform),
          status: log.status,
        },
      });
    }

    return feed
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, safeLimit);
  }

  async getWidgets(organizationId: string): Promise<DashboardWidgetsResponse> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { dashboardWidgets: true },
    });
    return { widgets: parseWidgetsJson(org?.dashboardWidgets) };
  }

  async updateWidgets(
    organizationId: string,
    widgets: DashboardWidgetConfig[],
  ): Promise<DashboardWidgetsResponse> {
    const normalized = widgets
      .map((w, index) => ({
        ...w,
        position: w.position ?? index,
        visible: w.visible ?? true,
      }))
      .sort((a, b) => a.position - b.position);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        dashboardWidgets: normalized as Prisma.InputJsonValue,
      },
    });

    return { widgets: normalized };
  }

  async getOrdersTrend(
    organizationId: string,
    days: number,
  ): Promise<DashboardOrdersTrendResponse> {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));

    const rows = await this.reports.getSalesReport(
      organizationId,
      start,
      end,
      'day',
    );
    const periodMap = new Map(
      rows.map((r) => [r.period.slice(0, 10), r]),
    );

    const points: DashboardOrdersTrendPoint[] = dayKeys(safeDays).map(
      ({ iso, label }) => {
        const row = periodMap.get(iso);
        return {
          date: iso,
          label,
          orderCount: row?.totalOrders ?? 0,
          revenue: row?.totalRevenue ?? 0,
        };
      },
    );

    return { days: safeDays, points };
  }

  async getPlatformDistribution(
    organizationId: string,
  ): Promise<DashboardPlatformDistributionResponse> {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    const rows = await this.reports.getPlatformReport(
      organizationId,
      start,
      end,
    );

    const slices: DashboardPlatformSlice[] = rows.map((row) => ({
      platform: row.platform,
      label:
        MARKETPLACE_LABEL_TR[
          row.platform as keyof typeof MARKETPLACE_LABEL_TR
        ] ?? row.platform,
      orderCount: row.orderCount,
      revenue: row.revenue,
    }));

    return { slices };
  }

  async getActivity(
    organizationId: string,
    limit: number,
  ): Promise<DashboardActivityItem[]> {
    const logs = await this.users.getAuditLog(organizationId, limit);
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      description: auditActionDescription(
        log.action,
        log.resource,
        log.metadata,
      ),
      createdAt: log.createdAt,
    }));
  }
}
