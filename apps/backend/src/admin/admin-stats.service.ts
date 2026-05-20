import { Injectable } from '@nestjs/common';
import { PlanTier, SubStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CohortData,
  GrowthMetrics,
  GrowthPeriod,
  MrrHistoryPoint,
  PlatformUsageItem,
} from './admin.types';

const PLAN_PRICES_KURUS: Record<PlanTier, number> = {
  BASLANGIC: 290_000,
  GELISIM: 590_000,
  PRO: 990_000,
  KURUMSAL: 1_990_000,
};

const PERIOD_DAYS: Record<GrowthPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

function addUtcMonths(d: Date, months: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 0, 0, 0, 0),
  );
}

function monthKeyUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGrowthMetrics(period: GrowthPeriod): Promise<GrowthMetrics> {
    const now = new Date();
    const days = PERIOD_DAYS[period];
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const activeSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      newOrganizations,
      churnedOrganizations,
      activeOrganizations,
      currentMrrKurus,
      previousMrrKurus,
    ] = await Promise.all([
      this.prisma.organization.count({
        where: { deletedAt: null, createdAt: { gte: periodStart } },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubStatus.CANCELLED,
          canceledAt: { gte: periodStart },
          organization: { deletedAt: null },
        },
      }),
      this.countActiveOrganizations(activeSince),
      this.computeMrrAt(now),
      this.computeMrrAt(periodStart),
    ]);

    const mrr = currentMrrKurus / 100;
    const arr = mrr * 12;
    const revenueGrowth =
      previousMrrKurus === 0
        ? currentMrrKurus > 0
          ? 100
          : 0
        : Math.round(
            ((currentMrrKurus - previousMrrKurus) / previousMrrKurus) * 1000,
          ) / 10;

    const activeAtPeriodStart = await this.countActiveOrganizations(
      new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000),
    );
    const churnRate =
      activeAtPeriodStart === 0
        ? 0
        : Math.round((churnedOrganizations / activeAtPeriodStart) * 1000) / 10;

    return {
      newOrganizations,
      activeOrganizations,
      churnedOrganizations,
      revenueGrowth,
      churnRate,
      mrrKurus: currentMrrKurus,
      arrKurus: currentMrrKurus * 12,
      mrr,
      arr,
    };
  }

  async getPlatformUsageStats(): Promise<PlatformUsageItem[]> {
    const [
      marketplaceGroups,
      erpGroups,
      syncCount,
      pricingCount,
      reportCount,
    ] = await Promise.all([
      this.prisma.marketplaceConnection.groupBy({
        by: ['platform'],
        where: { deletedAt: null, isActive: true },
        _count: { _all: true },
        orderBy: { _count: { platform: 'desc' } },
        take: 10,
      }),
      this.prisma.erpConnection.groupBy({
        by: ['erpType'],
        where: { deletedAt: null, isActive: true },
        _count: { _all: true },
        orderBy: { _count: { erpType: 'desc' } },
        take: 5,
      }),
      this.prisma.marketplaceConnection.count({
        where: {
          deletedAt: null,
          isActive: true,
          lastSyncAt: { not: null },
        },
      }),
      this.prisma.pricingRule.count({
        where: { organization: { deletedAt: null } },
      }),
      this.prisma.reportSchedule.count({
        where: { organization: { deletedAt: null }, deletedAt: null },
      }),
    ]);

    const items: PlatformUsageItem[] = [];

    for (const row of marketplaceGroups) {
      items.push({
        type: 'marketplace',
        key: row.platform,
        label: row.platform,
        count: row._count._all,
      });
    }

    for (const row of erpGroups) {
      items.push({
        type: 'erp',
        key: row.erpType,
        label: row.erpType,
        count: row._count._all,
      });
    }

    items.push(
      {
        type: 'feature',
        key: 'sync',
        label: 'Senkronizasyon',
        count: syncCount,
      },
      {
        type: 'feature',
        key: 'pricing',
        label: 'Fiyatlandırma',
        count: pricingCount,
      },
      {
        type: 'feature',
        key: 'reports',
        label: 'Raporlar',
        count: reportCount,
      },
    );

    return items;
  }

  async getCohortRetention(): Promise<CohortData[]> {
    const now = new Date();
    const cohortStart = addUtcMonths(startOfUtcMonth(now), -11);
    const cohortEnd = endOfUtcMonth(now);

    const cohortOrgs = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: cohortStart, lte: cohortEnd },
      },
      select: { id: true, createdAt: true },
    });

    const orgIds = cohortOrgs.map((o) => o.id);
    if (orgIds.length === 0) {
      return [];
    }

    const [logins, orders] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          organizationId: { in: orgIds },
          deletedAt: null,
          lastLoginAt: { not: null, gte: cohortStart },
        },
        select: { organizationId: true, lastLoginAt: true },
      }),
      this.prisma.order.findMany({
        where: {
          organizationId: { in: orgIds },
          deletedAt: null,
          createdAt: { gte: cohortStart },
        },
        select: { organizationId: true, createdAt: true },
      }),
    ]);

    const activityByOrgMonth = new Map<string, Set<string>>();
    const addActivity = (orgId: string, at: Date): void => {
      const key = monthKeyUtc(at);
      let set = activityByOrgMonth.get(orgId);
      if (!set) {
        set = new Set<string>();
        activityByOrgMonth.set(orgId, set);
      }
      set.add(key);
    };

    for (const u of logins) {
      if (u.lastLoginAt && u.organizationId) {
        addActivity(u.organizationId, u.lastLoginAt);
      }
    }
    for (const o of orders) {
      if (o.organizationId) {
        addActivity(o.organizationId, o.createdAt);
      }
    }

    const cohortMap = new Map<string, string[]>();
    for (const org of cohortOrgs) {
      const key = monthKeyUtc(org.createdAt);
      const list = cohortMap.get(key) ?? [];
      list.push(org.id);
      cohortMap.set(key, list);
    }

    const currentMonth = startOfUtcMonth(now);
    const result: CohortData[] = [];

    for (const [cohortMonth, members] of [...cohortMap.entries()].sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      const cohortDate = parseMonthKey(cohortMonth);
      const maxOffset = monthDiff(cohortDate, currentMonth);
      const retention: CohortData['retention'] = [];

      for (let offset = 0; offset <= maxOffset; offset++) {
        const targetMonth = addUtcMonths(cohortDate, offset);
        const targetKey = monthKeyUtc(targetMonth);
        let active = 0;
        for (const orgId of members) {
          const months = activityByOrgMonth.get(orgId);
          if (months?.has(targetKey)) {
            active += 1;
          } else if (offset === 0) {
            active += 1;
          }
        }
        retention.push({
          monthOffset: offset,
          monthKey: targetKey,
          rate:
            members.length === 0
              ? 0
              : Math.round((active / members.length) * 1000) / 10,
        });
      }

      result.push({
        cohortMonth,
        cohortSize: members.length,
        retention,
      });
    }

    return result;
  }

  async getMrrHistory(): Promise<MrrHistoryPoint[]> {
    const now = new Date();
    const seriesStart = addUtcMonths(startOfUtcMonth(now), -11);
    const monthEnds: Date[] = [];
    for (let i = 0; i < 12; i++) {
      monthEnds.push(endOfUtcMonth(addUtcMonths(seriesStart, i)));
    }

    const [subscriptions, signupRows, activeRows] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { organization: { deletedAt: null } },
        select: {
          plan: true,
          status: true,
          createdAt: true,
          canceledAt: true,
        },
      }),
      this.prisma.$queryRaw<{ month_key: string; c: bigint }[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
               COUNT(*)::bigint AS c
        FROM "Organization"
        WHERE "deletedAt" IS NULL
          AND "createdAt" >= ${seriesStart}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<{ month_key: string; org_id: string }[]>`
        SELECT DISTINCT month_key, org_id FROM (
          SELECT to_char(date_trunc('month', "lastLoginAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
                 "organizationId" AS org_id
          FROM "User"
          WHERE "deletedAt" IS NULL AND "lastLoginAt" >= ${seriesStart}
          UNION
          SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
                 "organizationId" AS org_id
          FROM "Order"
          WHERE "deletedAt" IS NULL AND "createdAt" >= ${seriesStart}
        ) t
      `,
    ]);

    const signupsByMonth = new Map<string, number>();
    for (const r of signupRows) {
      signupsByMonth.set(r.month_key, Number(r.c));
    }

    const activeByMonth = new Map<string, Set<string>>();
    for (const r of activeRows) {
      if (!r.org_id) {
        continue;
      }
      let set = activeByMonth.get(r.month_key);
      if (!set) {
        set = new Set<string>();
        activeByMonth.set(r.month_key, set);
      }
      set.add(r.org_id);
    }

    return monthEnds.map((monthEnd) => {
      const key = monthKeyUtc(monthEnd);
      let mrrKurus = 0;
      for (const sub of subscriptions) {
        if (sub.createdAt > monthEnd) {
          continue;
        }
        if (sub.status !== SubStatus.ACTIVE) {
          if (sub.canceledAt && sub.canceledAt <= monthEnd) {
            continue;
          }
          if (sub.status === SubStatus.CANCELLED || sub.status === SubStatus.EXPIRED) {
            continue;
          }
        }
        if (sub.status === SubStatus.ACTIVE) {
          mrrKurus += PLAN_PRICES_KURUS[sub.plan];
        }
      }
      return {
        monthKey: key,
        mrrKurus,
        newOrganizations: signupsByMonth.get(key) ?? 0,
        activeOrganizations: activeByMonth.get(key)?.size ?? 0,
      };
    });
  }

  private async computeMrrAt(at: Date): Promise<number> {
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.ACTIVE,
        createdAt: { lte: at },
        organization: { deletedAt: null },
        OR: [{ canceledAt: null }, { canceledAt: { gt: at } }],
      },
      select: { plan: true },
    });
    return subs.reduce((sum, s) => sum + PLAN_PRICES_KURUS[s.plan], 0);
  }

  private async countActiveOrganizations(since: Date): Promise<number> {
    const [loginOrgs, orderOrgs, syncOrgs] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: since },
          organization: { deletedAt: null },
        },
        select: { organizationId: true },
        distinct: ['organizationId'],
      }),
      this.prisma.order.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: since },
          organization: { deletedAt: null },
        },
        select: { organizationId: true },
        distinct: ['organizationId'],
      }),
      this.prisma.marketplaceConnection.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          lastSyncAt: { gte: since },
          organization: { deletedAt: null },
        },
        select: { organizationId: true },
        distinct: ['organizationId'],
      }),
    ]);

    const ids = new Set<string>();
    for (const row of [...loginOrgs, ...orderOrgs, ...syncOrgs]) {
      if (row.organizationId) {
        ids.add(row.organizationId);
      }
    }
    return ids.size;
  }
}

function parseMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
}

function monthDiff(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}
