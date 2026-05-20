import { Injectable } from '@nestjs/common';

import { BuyBoxService } from '../pricing/buybox.service';
import {
  MARKETPLACE_LABEL_TR,
  ReportsService,
} from '../reports/reports.service';
import { UsersService } from '../users/users.service';

import type {
  DashboardActivityItem,
  DashboardOrdersTrendPoint,
  DashboardOrdersTrendResponse,
  DashboardPlatformDistributionResponse,
  DashboardPlatformSlice,
  DashboardSummaryResponse,
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

@Injectable()
export class DashboardService {
  constructor(
    private readonly reports: ReportsService,
    private readonly buyBox: BuyBoxService,
    private readonly users: UsersService,
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
