import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import { MARKETPLACE_LABEL_TR } from './reports.service';

interface WeekComparison {
  orderCount: number;
  revenue: number;
  orderGrowthPct: number;
  revenueGrowthPct: number;
}

interface StockAlertRow {
  barcode: string;
  platform: string;
  quantity: number;
}

function platformLabel(platform: string): string {
  const key = platform as keyof typeof MARKETPLACE_LABEL_TR;
  return MARKETPLACE_LABEL_TR[key] ?? platform;
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

function growthPct(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function lastWeekRange(): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  const prevTo = new Date(from);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - 7);
  return { from, to, prevFrom, prevTo };
}

@Injectable()
export class WeeklyReportTask {
  private readonly logger = new Logger(WeeklyReportTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Cron('0 9 * * 1')
  async sendWeeklyReports(): Promise<void> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: {
        emailEnabled: true,
        emailWeeklyReport: true,
        user: { deletedAt: null },
      },
      select: {
        organizationId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    this.logger.log('Haftalık rapor e-postası kontrolü', { aday: prefs.length });

    for (const pref of prefs) {
      try {
        await this.sendWeeklyReportForUser(
          pref.organizationId,
          pref.user.email,
          pref.user.name,
        );
      } catch (error) {
        this.logger.error('Haftalık rapor e-postası gönderilemedi', {
          userId: pref.user.id,
          organizationId: pref.organizationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async sendWeeklyReportForUser(
    organizationId: string,
    email: string,
    userName: string,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { name: true },
    });
    if (!org) {
      return;
    }

    const { from, to, prevFrom, prevTo } = lastWeekRange();
    const [current, previous, platformRows, stockAlerts] = await Promise.all([
      this.loadWeekStats(organizationId, from, to),
      this.loadWeekStats(organizationId, prevFrom, prevTo),
      this.loadPlatformSummary(organizationId, from, to),
      this.loadCriticalStockAlerts(organizationId, 3),
    ]);

    const comparison: WeekComparison = {
      orderCount: current.orderCount,
      revenue: current.revenue,
      orderGrowthPct: growthPct(current.orderCount, previous.orderCount),
      revenueGrowthPct: growthPct(current.revenue, previous.revenue),
    };

    await this.emailService.sendWeeklyReportSummary(email, {
      userName,
      orgName: org.name,
      comparison,
      platformRows,
      stockAlerts,
    });
  }

  private async loadWeekStats(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{ orderCount: number; revenue: number }> {
    const where = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: from, lt: to },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
    };
    const [orderCount, agg] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
    ]);
    return {
      orderCount,
      revenue: Number(agg._sum.totalAmount ?? 0),
    };
  }

  private async loadPlatformSummary(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{ platform: string; orderCount: number; revenue: number }[]> {
    const rows = await this.prisma.order.groupBy({
      by: ['platform'],
      where: {
        organizationId,
        deletedAt: null,
        platformCreatedAt: { gte: from, lt: to },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    return rows
      .sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))
      .slice(0, 8)
      .map((row) => ({
        platform: platformLabel(row.platform),
        orderCount: row._count._all ?? 0,
        revenue: Number(row._sum?.totalAmount ?? 0),
      }));
  }

  private async loadCriticalStockAlerts(
    organizationId: string,
    limit: number,
  ): Promise<StockAlertRow[]> {
    const rows = await this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        quantity: { lte: 5 },
      },
      orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }],
      take: limit,
      select: { barcode: true, platform: true, quantity: true },
    });
    return rows.map((row) => ({
      barcode: row.barcode,
      platform: platformLabel(row.platform),
      quantity: row.quantity,
    }));
  }
}
