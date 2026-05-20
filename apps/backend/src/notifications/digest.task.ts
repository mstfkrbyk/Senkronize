import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, SyncLogStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';

import { EmailService } from './email/email.service';

const ISTANBUL_TZ = 'Europe/Istanbul';

interface DigestRecipient {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

function last24Hours(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 86_400_000);
  return { from, to };
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

function growthPct(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

@Injectable()
export class NotificationDigestTask {
  private readonly logger = new Logger(NotificationDigestTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly reportsService: ReportsService,
  ) {}

  /** Günlük özet — her gün 08:00 İstanbul */
  @Cron('0 8 * * *', { timeZone: ISTANBUL_TZ })
  async sendDailyDigests(): Promise<void> {
    const recipients = await this.getDailyDigestRecipients();
    this.logger.log('Günlük bildirim özeti', { aday: recipients.length });

    for (const user of recipients) {
      try {
        await this.sendDailyDigestForUser(user);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Günlük özet gönderilemedi: user=${user.id}`, {
          message,
        });
      }
    }
  }

  /** Haftalık özet — Pazartesi 09:00 İstanbul */
  @Cron('0 9 * * 1', { timeZone: ISTANBUL_TZ })
  async sendWeeklyDigests(): Promise<void> {
    const recipients = await this.getWeeklyDigestRecipients();
    this.logger.log('Haftalık bildirim özeti', { aday: recipients.length });

    for (const user of recipients) {
      try {
        await this.sendWeeklyDigestForUser(user);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Haftalık özet gönderilemedi: user=${user.id}`, {
          message,
        });
      }
    }
  }

  private async getDailyDigestRecipients(): Promise<DigestRecipient[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: {
        emailEnabled: true,
        digestFrequency: 'daily',
        user: { deletedAt: null },
      },
      select: {
        organizationId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      name: r.user.name,
      organizationId: r.organizationId,
    }));
  }

  private async getWeeklyDigestRecipients(): Promise<DigestRecipient[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: {
        emailEnabled: true,
        OR: [{ digestFrequency: 'weekly' }, { emailWeeklyReport: true }],
        user: { deletedAt: null },
      },
      select: {
        organizationId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      name: r.user.name,
      organizationId: r.organizationId,
    }));
  }

  private async sendDailyDigestForUser(user: DigestRecipient): Promise<void> {
    const { from, to } = last24Hours();
    const orgId = user.organizationId;

    const [newOrderCount, lowStockCount, syncErrors, queued] = await Promise.all([
      this.prisma.order.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          platformCreatedAt: { gte: from, lte: to },
        },
      }),
      this.prisma.listing.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          quantity: { lte: 5, gt: 0 },
          updatedAt: { gte: from },
        },
      }),
      this.prisma.syncLog.count({
        where: {
          organizationId: orgId,
          status: SyncLogStatus.FAILED,
          startedAt: { gte: from, lte: to },
        },
      }),
      this.prisma.notificationDigestItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: {
          eventType: true,
          title: true,
          message: true,
          link: true,
          createdAt: true,
        },
      }),
    ]);

    const summaryRows = [
      ...(newOrderCount > 0
        ? [
            {
              eventType: 'new_order',
              title: `${newOrderCount} yeni sipariş`,
              message: 'Son 24 saatte gelen siparişler',
              link: '/orders',
              createdAt: to,
            },
          ]
        : []),
      ...(lowStockCount > 0
        ? [
            {
              eventType: 'low_stock',
              title: `${lowStockCount} stok uyarısı`,
              message: 'Kritik stok seviyesindeki ürünler',
              link: '/stock',
              createdAt: to,
            },
          ]
        : []),
      ...(syncErrors > 0
        ? [
            {
              eventType: 'sync_error',
              title: `${syncErrors} senkron hatası`,
              message: 'Son 24 saatte başarısız senkron işlemleri',
              link: '/integrations',
              createdAt: to,
            },
          ]
        : []),
      ...queued.map((q) => ({
        eventType: q.eventType,
        title: q.title,
        message: q.message,
        link: q.link,
        createdAt: q.createdAt,
      })),
    ];

    if (summaryRows.length === 0) {
      return;
    }

    await this.emailService.sendDigestEmail(user.email, {
      period: 'daily',
      notifications: summaryRows,
    });

    await this.prisma.notificationDigestItem.deleteMany({
      where: { userId: user.id },
    });
  }

  private async sendWeeklyDigestForUser(user: DigestRecipient): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: user.organizationId, deletedAt: null },
      select: { name: true },
    });
    if (!org) {
      return;
    }

    const { from, to, prevFrom, prevTo } = lastWeekRange();
    const orgId = user.organizationId;

    const [currentStats, previousStats, platformComparison, topProducts] =
      await Promise.all([
        this.loadWeekStats(orgId, from, to),
        this.loadWeekStats(orgId, prevFrom, prevTo),
        this.reportsService.getPlatformComparison(orgId, { from, to }),
        this.reportsService.getTopProducts(orgId, 5, from, to),
      ]);

    const platformRows = platformComparison.platforms.slice(0, 8).map((row) => ({
      platform: row.name,
      orderCount: row.orderCount,
      revenue: row.revenue,
    }));

    await this.emailService.sendWeeklyReportSummary(user.email, {
      userName: user.name,
      orgName: org.name,
      comparison: {
        orderCount: currentStats.orderCount,
        revenue: currentStats.revenue,
        orderGrowthPct: growthPct(
          currentStats.orderCount,
          previousStats.orderCount,
        ),
        revenueGrowthPct: growthPct(
          currentStats.revenue,
          previousStats.revenue,
        ),
      },
      platformRows,
      stockAlerts: topProducts.map((p) => ({
        barcode: p.barcode,
        platform: '—',
        quantity: p.totalQuantity,
      })),
    });

    const queued = await this.prisma.notificationDigestItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        eventType: true,
        title: true,
        message: true,
        link: true,
        createdAt: true,
      },
    });

    if (queued.length > 0) {
      await this.emailService.sendDigestEmail(user.email, {
        period: 'weekly',
        notifications: queued,
      });
      await this.prisma.notificationDigestItem.deleteMany({
        where: { userId: user.id },
      });
    }
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
}
