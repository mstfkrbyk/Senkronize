import { PassThrough } from 'stream';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import archiver from 'archiver';
import {
  AccountingMode,
  Marketplace,
  OrgType,
  PartnerLinkStatus,
  PartnerStatus,
  PaymentStatus,
  PlanTier,
  Prisma,
  SubStatus,
  SyncLogStatus,
  UserRole,
} from '@prisma/client';
import Papa from 'papaparse';

import type { AuthenticatedUser, JwtPayload } from '../auth/auth.types';
import { SessionService } from '../auth/session.service';
import { EmailService } from '../notifications/email/email.service';
import {
  getAccountingModeChangeBlockReason,
  productSelectionToInitialAccountingMode,
  organizationWhereResolvedAccountingMode,
  resolveOrganizationAccountingMode,
} from '../common/accounting-mode';
import {
  isBillingExempt,
  isInternalAccount,
  mergeInternalAccountMetadata,
} from '../organization/organization-internal';
import { dbLimitsForPlan } from '../subscription/plan-limits';
import {
  countExtraErpSlots,
  effectiveErpSlotLimit,
  mergeExtraErpSlotAddon,
} from '../erp-connection/erp-slot-limit.util';
import {
  adminOrgProductLineWhere,
  productSelectionToProductLines,
  resolveOrgProductLines,
  type AdminOrgProductFilter,
  type ProductSelection,
} from '../common/product-lines';
import { CacheKeys } from '../common/cache/cache-keys';
import { CACHE_TTL } from '../common/cache/cache-ttl';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { ensureArray } from './admin-array.util';
import {
  ADMIN_PLATFORM_ACTIVITY_EXPORT_MAX,
  buildAdminPlatformActivityCsv,
} from './admin-platform-activity-csv';
import {
  ADMIN_USERS_EXPORT_MAX,
  buildAdminUsersCsv,
} from './admin-users-csv';
import {
  CUSTOMER_ORG_WHERE,
  PLATFORM_ORG_SLUG,
  customerOrgWhere,
} from './admin-customer-org';
import type {
  AdminUsersQueryDto,
  UpdateAdminOrganizationInfoDto,
  UpdateAdminUserDto,
} from './admin.dto';
import type {
  ActivityItem,
  ActivitySummary,
  AdminOrgListItem,
  AdminUserListItem,
  AdminUserDetail,
  DailySignupPoint,
  HealthStats,
  OrgDataExport,
  OrgNoteItem,
  OrganizationDetail,
  PaginatedOrganizations,
  PaginatedUsers,
  PlatformHealthRow,
  PlatformStats,
  RevenueStats,
} from './admin.types';

const PLAN_PRICES_KURUS: Record<PlanTier, number> = {
  BASLANGIC: 290_000,
  GELISIM: 590_000,
  PRO: 990_000,
  KURUMSAL: 1_990_000,
};

const ADMIN_ORG_LIST_INCLUDE = Prisma.validator<Prisma.OrganizationInclude>()({
  _count: {
    select: {
      users: { where: { deletedAt: null } },
      marketplaceConnections: { where: { deletedAt: null } },
      orders: { where: { deletedAt: null } },
      erpConnections: { where: { deletedAt: null, isActive: true } },
    },
  },
  subscription: {
    select: { plan: true, status: true, trialEndsAt: true },
  },
  users: {
    where: { deletedAt: null },
    orderBy: { lastLoginAt: 'desc' },
    take: 1,
    select: { lastLoginAt: true },
  },
  orders: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true },
  },
  clientRelationships: {
    where: { status: PartnerStatus.ACTIVE },
    orderBy: { acceptedAt: 'desc' },
    take: 3,
    select: {
      partnerOrg: { select: { id: true, name: true, slug: true } },
    },
  },
});

type OrgListRow = Prisma.OrganizationGetPayload<{
  include: typeof ADMIN_ORG_LIST_INCLUDE;
}>;

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
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

function parseDurationMs(meta: unknown): number | null {
  if (meta && typeof meta === 'object' && 'durationMs' in meta) {
    const v = (meta as { durationMs: unknown }).durationMs;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  return null;
}

function computeHealthScore(rows: PlatformHealthRow[]): number {
  if (rows.length === 0) {
    return 100;
  }
  const avgErr =
    rows.reduce((s, r) => s + r.errorRate24h, 0) / rows.length;
  const raw = Math.round((1 - Math.min(avgErr, 1)) * 100);
  return Math.max(0, Math.min(100, raw));
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly cache: CacheService,
  ) {}

  async getPlatformStats(
    product?: AdminOrgProductFilter,
  ): Promise<PlatformStats> {
    return this.cache.readThrough(
      CacheKeys.adminStatsPlatform(product ?? 'all'),
      CACHE_TTL.ADMIN_STATS,
      () => this.loadPlatformStats(product),
    );
  }

  private async loadPlatformStats(
    product?: AdminOrgProductFilter,
  ): Promise<PlatformStats> {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = startOfUtcMonth(now);
    const scopedCustomerWhere = product
      ? customerOrgWhere(adminOrgProductLineWhere(product))
      : CUSTOMER_ORG_WHERE;

    const [
      totalOrganizations,
      activeOrganizations,
      inactiveOrganizations,
      totalUsers,
      planGroups,
      trialActiveOrganizations,
      newRegistrationsLast30Days,
      ordersThisMonthCount,
      activeMarketplaceConnections,
      health,
      dailyNewRegistrations,
      integrationOnlyOrgs,
      accountingOnlyOrgs,
      bundleOrgs,
      nativeAccountingOrgs,
      externalErpAccountingOrgs,
    ] = await Promise.all([
      this.prisma.organization.count({ where: scopedCustomerWhere }),
      this.prisma.organization.count({
        where: { AND: [scopedCustomerWhere, { suspended: false }] },
      }),
      this.prisma.organization.count({
        where: { AND: [scopedCustomerWhere, { suspended: true }] },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          organization: scopedCustomerWhere,
        },
      }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        where: { organization: scopedCustomerWhere },
        _count: { _all: true },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubStatus.TRIAL,
          organization: scopedCustomerWhere,
          OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }],
        },
      }),
      this.prisma.organization.count({
        where: {
          AND: [scopedCustomerWhere, { createdAt: { gte: since30 } }],
        },
      }),
      this.prisma.order.count({
        where: {
          deletedAt: null,
          createdAt: { gte: monthStart },
          organization: scopedCustomerWhere,
        },
      }),
      this.prisma.marketplaceConnection.count({
        where: {
          isActive: true,
          deletedAt: null,
          organization: scopedCustomerWhere,
        },
      }),
      this.buildPlatformHealth(),
      this.getDailySignupsLast30Days(product),
      this.prisma.organization.count({
        where: customerOrgWhere(adminOrgProductLineWhere('INTEGRATION')),
      }),
      this.prisma.organization.count({
        where: customerOrgWhere(adminOrgProductLineWhere('ACCOUNTING')),
      }),
      this.prisma.organization.count({
        where: customerOrgWhere(adminOrgProductLineWhere('BUNDLE')),
      }),
      this.prisma.organization.count({
        where: customerOrgWhere(
          organizationWhereResolvedAccountingMode(AccountingMode.NATIVE),
        ),
      }),
      this.prisma.organization.count({
        where: customerOrgWhere(
          organizationWhereResolvedAccountingMode(AccountingMode.EXTERNAL_ERP),
        ),
      }),
    ]);

    const allTiers = Object.values(PlanTier);
    const planMap = new Map(
      ensureArray(planGroups).map((g) => [g.plan, g._count._all] as const),
    );
    const planDistribution = allTiers.map((plan) => ({
      plan,
      count: planMap.get(plan) ?? 0,
    }));

    return {
      totalOrganizations,
      activeOrganizations,
      inactiveOrganizations,
      totalUsers,
      planDistribution,
      productLineDistribution: [
        { bucket: 'INTEGRATION', count: integrationOnlyOrgs },
        { bucket: 'ACCOUNTING', count: accountingOnlyOrgs },
        { bucket: 'BUNDLE', count: bundleOrgs },
      ],
      accountingModeDistribution: [
        { mode: AccountingMode.NATIVE, count: nativeAccountingOrgs },
        {
          mode: AccountingMode.EXTERNAL_ERP,
          count: externalErpAccountingOrgs,
        },
      ],
      trialActiveOrganizations,
      newRegistrationsLast30Days,
      ordersThisMonthCount,
      activeMarketplaceConnections,
      platformHealthScore: computeHealthScore(ensureArray(health)),
      dailyNewRegistrations: ensureArray(dailyNewRegistrations),
    };
  }

  async getRevenueStats(): Promise<RevenueStats> {
    return this.cache.readThrough(
      CacheKeys.adminStatsRevenue(),
      CACHE_TTL.ADMIN_STATS,
      () => this.loadRevenueStats(),
    );
  }

  private async loadRevenueStats(): Promise<RevenueStats> {
    const activeSubs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.ACTIVE,
        organization: CUSTOMER_ORG_WHERE,
      },
      select: { plan: true },
    });

    let mrrKurus = 0;
    const planCounts = new Map<PlanTier, number>();
    for (const s of activeSubs) {
      mrrKurus += PLAN_PRICES_KURUS[s.plan];
      planCounts.set(s.plan, (planCounts.get(s.plan) ?? 0) + 1);
    }

    const planRevenueDistribution = Object.values(PlanTier).map((plan) => ({
      plan,
      monthlyRevenueKurus:
        (PLAN_PRICES_KURUS[plan] ?? 0) * (planCounts.get(plan) ?? 0),
      organizationCount: planCounts.get(plan) ?? 0,
    }));

    const now = new Date();
    const seriesStart = addUtcMonths(startOfUtcMonth(now), -11);
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: seriesStart },
      },
      select: { amount: true, createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = addUtcMonths(seriesStart, i);
      buckets.set(monthKeyUtc(d), 0);
    }
    for (const p of payments) {
      const key = monthKeyUtc(p.createdAt);
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + p.amount);
      }
    }

    const last12MonthsRevenue = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, revenueKurus]) => ({ monthKey, revenueKurus }));

    return {
      mrrKurus,
      projectedArrKurus: mrrKurus * 12,
      planRevenueDistribution,
      last12MonthsRevenue,
    };
  }

  async getDailySignupsLast30Days(
    product?: AdminOrgProductFilter,
  ): Promise<DailySignupPoint[]> {
    const now = new Date();
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    start.setUTCHours(0, 0, 0, 0);

    if (product) {
      const orgs = await this.prisma.organization.findMany({
        where: {
          AND: [
            customerOrgWhere(adminOrgProductLineWhere(product)),
            { createdAt: { gte: start } },
          ],
        },
        select: { createdAt: true },
      });
      const map = new Map<string, number>();
      for (const org of orgs) {
        const key = org.createdAt.toISOString().slice(0, 10);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const out: DailySignupPoint[] = [];
      for (let i = 0; i < 30; i++) {
        const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const key = day.toISOString().slice(0, 10);
        out.push({ date: key, count: map.get(key) ?? 0 });
      }
      return out;
    }

    const rows = await this.prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS d, COUNT(*)::bigint AS c
      FROM "Organization"
      WHERE "deletedAt" IS NULL
        AND "type" = 'DIRECT'::"OrgType"
        AND "slug" <> ${PLATFORM_ORG_SLUG}
        AND "createdAt" >= ${start}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.d.toISOString().slice(0, 10);
      map.set(key, Number(r.c));
    }

    const out: DailySignupPoint[] = [];
    for (let i = 0; i < 30; i++) {
      const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      out.push({ date: key, count: map.get(key) ?? 0 });
    }
    return out;
  }

  async getActiveOrganizations(
    page: number,
    limit: number,
    search?: string,
    plan?: PlanTier,
    status?: string,
    product?: AdminOrgProductFilter,
    partnerOrgId?: string,
    accountingMode?: AccountingMode,
  ): Promise<PaginatedOrganizations> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const s = search?.trim();

    const andParts: Prisma.OrganizationWhereInput[] = [CUSTOMER_ORG_WHERE];

    if (s && s.length > 0) {
      andParts.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { taxNumber: { contains: s, mode: 'insensitive' } },
          {
            users: {
              some: {
                deletedAt: null,
                email: { contains: s, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    if (plan) {
      andParts.push({ subscription: { is: { plan } } });
    }

    if (status === 'ASKIDA') {
      andParts.push({ suspended: true });
    } else if (status === 'DENEME') {
      andParts.push({ suspended: false });
      andParts.push({
        subscription: { is: { status: SubStatus.TRIAL } },
      });
    } else if (status === 'AKTIF') {
      andParts.push({ suspended: false });
      andParts.push({
        OR: [
          { subscription: null },
          {
            subscription: {
              is: { status: { not: SubStatus.TRIAL } },
            },
          },
        ],
      });
    }

    if (product) {
      andParts.push(adminOrgProductLineWhere(product));
    }

    const partnerId = partnerOrgId?.trim();
    if (partnerId) {
      andParts.push({
        clientRelationships: {
          some: {
            partnerOrgId: partnerId,
            status: PartnerStatus.ACTIVE,
          },
        },
      });
    }

    if (accountingMode) {
      andParts.push(organizationWhereResolvedAccountingMode(accountingMode));
    }

    const where: Prisma.OrganizationWhereInput =
      andParts.length === 1 ? andParts[0]! : { AND: andParts };

    const [orgs, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: ADMIN_ORG_LIST_INCLUDE,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      orgs: ensureArray(orgs).map((o) => this.mapOrgListItem(o)),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  async getPlatformOrganization(): Promise<{
    id: string;
    name: string;
    slug: string;
  } | null> {
    const org = await this.prisma.organization.findFirst({
      where: { slug: PLATFORM_ORG_SLUG, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    return org;
  }

  async getOrganizationDetail(orgId: string): Promise<OrganizationDetail> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: {
        subscription: true,
        users: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        marketplaceConnections: {
          where: { deletedAt: null },
          orderBy: { platform: 'asc' },
          select: {
            id: true,
            platform: true,
            isActive: true,
            lastSyncAt: true,
            syncErrorCount: true,
            lastErrorAt: true,
          },
        },
        orders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            platform: true,
            platformOrderId: true,
            status: true,
            customerName: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    });

    if (!org) {
      const other = await this.prisma.organization.findFirst({
        where: { id: orgId, deletedAt: null },
        select: { type: true, slug: true },
      });
      if (other?.type === OrgType.PARTNER) {
        throw new BadRequestException(
          'Partner detayı için Partnerler sayfasını kullanın.',
        );
      }
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    if (org.type === OrgType.PARTNER) {
      throw new BadRequestException(
        'Partner detayı için Partnerler sayfasını kullanın.',
      );
    }

    const activePartners = await this.prisma.partnerRelationship.findMany({
      where: {
        clientOrgId: orgId,
        status: PartnerStatus.ACTIVE,
      },
      orderBy: { acceptedAt: 'desc' },
      select: {
        id: true,
        partnerOrgId: true,
        commissionPct: true,
        canImpersonate: true,
        acceptedAt: true,
        partnerOrg: { select: { name: true, slug: true } },
      },
    });

    const [recentAuditLogs, payments, activeErpConnectionCount, erpConnections] =
      await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { actorOrgId: orgId },
            { impersonatedOrgId: orgId },
            {
              AND: [
                { resourceId: orgId },
                { resourceType: 'Organization' },
              ],
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          actorUserId: true,
          actorOrgId: true,
          impersonatedOrgId: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          plan: true,
          createdAt: true,
        },
      }),
      this.prisma.erpConnection.count({
        where: { organizationId: orgId, deletedAt: null, isActive: true },
      }),
      this.prisma.erpConnection.findMany({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          erpType: true,
          displayName: true,
          role: true,
          isActive: true,
          lastSyncAt: true,
          syncErrorCount: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          createdAt: true,
        },
      }),
    ]);

    const {
      subscription,
      users,
      marketplaceConnections,
      orders,
      productLines,
      accountingMode,
      ...rest
    } = org;

    return {
      organization: {
        id: rest.id,
        slug: rest.slug,
        name: rest.name,
        taxNumber: rest.taxNumber,
        taxOffice: rest.taxOffice,
        address: rest.address,
        city: rest.city,
        website: rest.website,
        type: rest.type,
        suspended: rest.suspended,
        onboardingCompleted: rest.onboardingCompleted,
        createdAt: rest.createdAt,
      },
      orgProducts: resolveOrgProductLines(productLines),
      accountingMode,
      activeErpConnectionCount,
      erpConnections: ensureArray(erpConnections),
      erpSlotLimit: effectiveErpSlotLimit({
        subscription: subscription ?? null,
        isInternalAccount: isInternalAccount(org),
      }),
      extraErpSlotCount: countExtraErpSlots(subscription?.addons),
      activePartners: ensureArray(activePartners).map((r) => ({
        relationshipId: r.id,
        partnerOrgId: r.partnerOrgId,
        name: r.partnerOrg.name,
        slug: r.partnerOrg.slug,
        commissionPct: Number(r.commissionPct),
        canImpersonate: r.canImpersonate,
        acceptedAt: r.acceptedAt,
      })),
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            nextBillingAt: subscription.nextBillingAt,
          }
        : null,
      users: ensureArray(users),
      marketplaceConnections: ensureArray(marketplaceConnections),
      recentOrders: ensureArray(orders).map((o) => ({
        ...o,
        totalAmount: o.totalAmount.toString(),
      })),
      recentAuditLogs: ensureArray(recentAuditLogs),
      payments: isBillingExempt(org) ? [] : ensureArray(payments),
      internalAccount: isInternalAccount(org),
      billingExempt: isBillingExempt(org),
    };
  }

  async grantExtraErpSlot(
    orgId: string,
    quantity: number,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<{ extraErpSlotCount: number; erpSlotLimit: number | null }> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { id: true, slug: true, metadata: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });
    if (!subscription) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }

    const mergedAddons = mergeExtraErpSlotAddon(subscription.addons, quantity);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { organizationId: orgId },
        data: { addons: mergedAddons as unknown as Prisma.InputJsonValue },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_extra_erp_slot_granted',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {
            reason,
            quantityAdded: quantity,
            extraErpSlotCount: countExtraErpSlots(mergedAddons),
          },
        },
      }),
    ]);
    await this.cache.del(CacheKeys.subscription(orgId));

    return {
      extraErpSlotCount: countExtraErpSlots(mergedAddons),
      erpSlotLimit: effectiveErpSlotLimit({
        subscription: { addons: mergedAddons },
        isInternalAccount: isInternalAccount(org),
      }),
    };
  }

  async configureInternalAccount(
    orgId: string,
    dto: { enabled: boolean; plan?: PlanTier; reason: string },
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: { subscription: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    if (!org.subscription) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }

    const meta = mergeInternalAccountMetadata(org.metadata, dto.enabled);
    const plan = dto.plan ?? PlanTier.KURUMSAL;
    const limits = dbLimitsForPlan(plan);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 50);

    const subscriptionUpdate: Prisma.SubscriptionUpdateInput = dto.enabled
      ? {
          plan,
          status: SubStatus.ACTIVE,
          trialEndsAt: null,
          nextBillingAt: null,
          canceledAt: null,
          cancelReason: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          monthlyOrderLimit: limits.monthlyOrderLimit,
          marketplaceLimit: limits.marketplaceLimit,
          ecommerceLimit: limits.ecommerceLimit,
          erpLimit: limits.erpLimit,
          userLimit: limits.userLimit,
        }
      : {};

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: orgId },
        data: { metadata: meta as Prisma.InputJsonValue },
      }),
      ...(dto.enabled
        ? [
            this.prisma.subscription.update({
              where: { organizationId: orgId },
              data: subscriptionUpdate,
            }),
          ]
        : []),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.internal_account_configured',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {
            reason: dto.reason,
            enabled: dto.enabled,
            plan: dto.enabled ? plan : null,
          },
        },
      }),
    ]);

    await this.cache.del(CacheKeys.subscription(orgId));
  }

  async suspendOrganization(
    orgId: string,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    if (existing.suspended) {
      throw new ConflictException('Organizasyon zaten askıda.');
    }

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: orgId },
        data: { suspended: true },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_suspended',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: { reason },
        },
      }),
    ]);
  }

  async unsuspendOrganization(
    orgId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    if (!existing.suspended) {
      throw new ConflictException('Organizasyon askıda değil.');
    }

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: orgId },
        data: { suspended: false },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_unsuspended',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {},
        },
      }),
    ]);
  }

  async impersonateOrganization(
    orgId: string,
    actor: AuthenticatedUser,
  ): Promise<{ token: string; impersonationToken: string }> {
    const target = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId,
        impersonatedOrgId: orgId,
        action: 'admin.impersonation_start',
        resourceType: 'Organization',
        resourceId: orgId,
        metadata: {},
      },
    });

    const payload: JwtPayload = {
      sub: actor.id,
      orgId: actor.organizationId,
      role: actor.role,
      impersonatedOrgId: orgId,
    };

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const token = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '4h',
    });

    return { token, impersonationToken: token };
  }

  static readonly ACTIVITY_LIST_MAX = 100;

  async getRecentActivity(
    limit: number,
    maxCap: number = AdminService.ACTIVITY_LIST_MAX,
  ): Promise<ActivityItem[]> {
    const take = Math.min(Math.max(limit, 1), maxCap);
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        actorUserId: true,
        actorOrgId: true,
        impersonatedOrgId: true,
        createdAt: true,
      },
    });

    const orgIds = new Set<string>();
    for (const row of rows) {
      orgIds.add(row.actorOrgId);
      if (row.impersonatedOrgId) {
        orgIds.add(row.impersonatedOrgId);
      }
    }

    const orgNames =
      orgIds.size > 0
        ? await this.prisma.organization.findMany({
            where: { id: { in: [...orgIds] } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(orgNames.map((o) => [o.id, o.name]));

    return rows.map((row) => ({
      ...row,
      actorOrgName: nameById.get(row.actorOrgId) ?? null,
      impersonatedOrgName: row.impersonatedOrgId
        ? (nameById.get(row.impersonatedOrgId) ?? null)
        : null,
    }));
  }

  async exportPlatformActivityCsv(): Promise<string> {
    const rows = await this.getRecentActivity(
      ADMIN_PLATFORM_ACTIVITY_EXPORT_MAX,
      ADMIN_PLATFORM_ACTIVITY_EXPORT_MAX,
    );
    return buildAdminPlatformActivityCsv(rows);
  }

  async getPlatformHealthStats(): Promise<HealthStats> {
    return { platforms: await this.buildPlatformHealth() };
  }

  async changePlan(
    orgId: string,
    newPlan: PlanTier,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: { subscription: true },
    });
    if (!org?.subscription) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (org.subscription.plan === newPlan) {
      throw new BadRequestException('Organizasyon zaten bu pakette.');
    }

    const limits = dbLimitsForPlan(newPlan);

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { organizationId: orgId },
        data: {
          plan: newPlan,
          ...limits,
          ...(isInternalAccount(org)
            ? { status: SubStatus.ACTIVE, trialEndsAt: null, nextBillingAt: null }
            : {}),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.subscription_plan_changed',
          resourceType: 'Subscription',
          resourceId: org.subscription.id,
          metadata: {
            reason,
            previousPlan: org.subscription.plan,
            newPlan,
          },
        },
      }),
    ]);

    await this.cache.del(CacheKeys.subscription(orgId));
  }

  async updateSubscription(
    orgId: string,
    dto: { status?: SubStatus; trialEndsAt?: string; reason: string },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (dto.status === undefined && dto.trialEndsAt === undefined) {
      throw new BadRequestException(
        'Durum veya deneme bitiş tarihi güncellenmelidir.',
      );
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: { subscription: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    if (org.slug === PLATFORM_ORG_SLUG) {
      throw new BadRequestException(
        'Platform organizasyonunun aboneliği değiştirilemez.',
      );
    }
    if (!org.subscription) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }

    const sub = org.subscription;
    const nextStatus = dto.status ?? sub.status;
    const nextTrialEndsAt =
      dto.trialEndsAt !== undefined
        ? dto.trialEndsAt
          ? new Date(dto.trialEndsAt)
          : null
        : sub.trialEndsAt;

    const statusUnchanged = nextStatus === sub.status;
    const trialUnchanged =
      (nextTrialEndsAt === null && sub.trialEndsAt === null) ||
      (nextTrialEndsAt !== null &&
        sub.trialEndsAt !== null &&
        nextTrialEndsAt.getTime() === sub.trialEndsAt.getTime());

    if (statusUnchanged && trialUnchanged) {
      throw new BadRequestException('Abonelikte değişiklik yok.');
    }

    const updateData: Prisma.SubscriptionUpdateInput = {};
    if (!statusUnchanged) {
      updateData.status = nextStatus;
    }
    if (!trialUnchanged) {
      updateData.trialEndsAt = nextTrialEndsAt;
    }

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { organizationId: orgId },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.subscription_updated',
          resourceType: 'Subscription',
          resourceId: sub.id,
          metadata: {
            reason: dto.reason,
            previousStatus: sub.status,
            newStatus: nextStatus,
            previousTrialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
            newTrialEndsAt: nextTrialEndsAt?.toISOString() ?? null,
          },
        },
      }),
    ]);
  }

  async changeProductLines(
    orgId: string,
    productSelection: ProductSelection,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { id: true, productLines: true, accountingMode: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const previous = resolveOrgProductLines(org.productLines);
    const nextLines = productSelectionToProductLines(productSelection);
    const nextResolved = resolveOrgProductLines(nextLines);
    const same =
      previous.length === nextResolved.length &&
      previous.every((line) => nextResolved.includes(line));
    if (same) {
      throw new BadRequestException('Organizasyon zaten bu ürün hattında.');
    }

    const accountingMode =
      org.accountingMode ??
      productSelectionToInitialAccountingMode(productSelection);

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: orgId },
        data: {
          productLines: nextLines,
          accountingMode,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_product_lines_changed',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {
            reason,
            previousProductLines: previous,
            productSelection,
          },
        },
      }),
    ]);
  }

  async changeAccountingMode(
    orgId: string,
    accountingMode: AccountingMode,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { id: true, accountingMode: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    if (org.accountingMode === accountingMode) {
      throw new BadRequestException('Organizasyon zaten bu muhasebe modunda.');
    }

    const activeErpCount = await this.prisma.erpConnection.count({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
    });
    const blockReason = getAccountingModeChangeBlockReason(
      accountingMode,
      activeErpCount,
    );
    if (blockReason) {
      throw new ConflictException(blockReason);
    }

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: orgId },
        data: { accountingMode },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_accounting_mode_changed',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {
            reason,
            previousAccountingMode: org.accountingMode,
            newAccountingMode: accountingMode,
            activeErpConnectionCount: activeErpCount,
          },
        },
      }),
    ]);
  }

  async assignPartnerToOrganization(
    clientOrgId: string,
    partnerOrgId: string,
    actor: AuthenticatedUser,
    reason?: string,
  ): Promise<void> {
    const client = await this.prisma.organization.findFirst({
      where: { id: clientOrgId, deletedAt: null },
      select: { id: true, type: true, name: true },
    });
    if (!client) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    if (client.type !== OrgType.DIRECT) {
      throw new BadRequestException(
        'Yalnızca doğrudan müşteri organizasyonlarına partner atanabilir.',
      );
    }

    const partner = await this.prisma.organization.findFirst({
      where: { id: partnerOrgId, type: OrgType.PARTNER, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!partner) {
      throw new NotFoundException('Partner organizasyonu bulunamadı.');
    }

    const profile = await this.prisma.partnerProfile.findUnique({
      where: { organizationId: partnerOrgId },
    });
    const commissionPct = profile?.commissionRate ?? new Prisma.Decimal(10);

    await this.prisma.$transaction(async (tx) => {
      const pendingRequest = await tx.partnerLinkRequest.findUnique({
        where: {
          clientOrgId_partnerOrgId: { clientOrgId, partnerOrgId },
        },
      });
      if (pendingRequest?.status === PartnerLinkStatus.PENDING) {
        await tx.partnerLinkRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: PartnerLinkStatus.APPROVED,
            reviewedAt: new Date(),
            reviewedBy: actor.id,
          },
        });
      }

      await tx.partnerRelationship.upsert({
        where: {
          partnerOrgId_clientOrgId: { partnerOrgId, clientOrgId },
        },
        create: {
          partnerOrgId,
          clientOrgId,
          status: PartnerStatus.ACTIVE,
          commissionPct,
          canImpersonate: true,
          acceptedAt: new Date(),
        },
        update: {
          status: PartnerStatus.ACTIVE,
          commissionPct,
          acceptedAt: new Date(),
          inviteToken: null,
          inviteExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_partner_assigned',
          resourceType: 'Organization',
          resourceId: clientOrgId,
          metadata: {
            partnerOrgId,
            partnerName: partner.name,
            reason: reason ?? null,
          },
        },
      });
    });
  }

  async removePartnerFromOrganization(
    clientOrgId: string,
    partnerOrgId: string,
    actor: AuthenticatedUser,
    reason?: string,
  ): Promise<void> {
    const rel = await this.prisma.partnerRelationship.findUnique({
      where: {
        partnerOrgId_clientOrgId: { partnerOrgId, clientOrgId },
      },
    });
    if (!rel || rel.status !== PartnerStatus.ACTIVE) {
      throw new NotFoundException('Aktif partner bağlantısı bulunamadı.');
    }

    await this.prisma.$transaction([
      this.prisma.partnerRelationship.update({
        where: { id: rel.id },
        data: { status: PartnerStatus.TERMINATED },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_partner_removed',
          resourceType: 'PartnerRelationship',
          resourceId: rel.id,
          metadata: {
            clientOrgId,
            partnerOrgId,
            reason: reason ?? null,
          },
        },
      }),
    ]);
  }

  private mapOrgListItem(o: OrgListRow): AdminOrgListItem {
    const lastUser = o.users[0]?.lastLoginAt;
    const lastOrder = o.orders[0]?.createdAt;
    let lastActivityAt: string | null = null;
    if (lastUser && lastOrder) {
      lastActivityAt =
        lastUser > lastOrder ? lastUser.toISOString() : lastOrder.toISOString();
    } else if (lastUser) {
      lastActivityAt = lastUser.toISOString();
    } else if (lastOrder) {
      lastActivityAt = lastOrder.toISOString();
    }

    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      taxNumber: o.taxNumber,
      suspended: o.suspended,
      createdAt: o.createdAt,
      subscription: o.subscription,
      _count: o._count,
      lastActivityAt,
      orgProducts: resolveOrgProductLines(o.productLines),
      accountingMode: resolveOrganizationAccountingMode(
        o.accountingMode,
        o._count.erpConnections,
      ),
      activePartners: ensureArray(o.clientRelationships).map((rel) => ({
        id: rel.partnerOrg.id,
        name: rel.partnerOrg.name,
        slug: rel.partnerOrg.slug,
      })),
    };
  }

  private buildAdminUsersWhere(
    filters: AdminUsersQueryDto,
  ): Prisma.UserWhereInput {
    const search = filters.search?.trim();
    return {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters.orgId ? { organizationId: filters.orgId } : {}),
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.product
        ? {
            organization: customerOrgWhere(
              adminOrgProductLineWhere(filters.product),
            ),
          }
        : {}),
    };
  }

  private mapAdminUserListItem(
    u: Prisma.UserGetPayload<{
      include: { organization: { select: { id: true; name: true; slug: true } } };
    }>,
  ): AdminUserListItem {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      suspended: u.suspended,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      organization: u.organization,
    };
  }

  async getUsers(filters: AdminUsersQueryDto): Promise<PaginatedUsers> {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.buildAdminUsersWhere(filters);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: ensureArray(users).map((u) => this.mapAdminUserListItem(u)),
      total,
      page,
      limit,
    };
  }

  async exportUsersCsv(filters: AdminUsersQueryDto): Promise<string> {
    const users = await this.prisma.user.findMany({
      where: this.buildAdminUsersWhere(filters),
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: ADMIN_USERS_EXPORT_MAX,
    });
    return buildAdminUsersCsv(
      ensureArray(users).map((u) => this.mapAdminUserListItem(u)),
    );
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, suspended: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      suspended: user.suspended,
      lastLoginAt: user.lastLoginAt,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      organization: user.organization,
    };
  }

  async changeUserRole(
    userId: string,
    role: UserRole,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const user = await this.requireActiveUser(userId);
    if (user.role === role) {
      throw new BadRequestException('Kullanıcı zaten bu role sahip.');
    }
    if (user.role === UserRole.SUPER_ADMIN || role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Super Admin rolü bu yolla değiştirilemez.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { role },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.user_role_changed',
          resourceType: 'User',
          resourceId: userId,
          metadata: { previousRole: user.role, newRole: role },
        },
      }),
    ]);
  }

  async suspendUser(userId: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.requireActiveUser(userId);
    if (user.suspended) {
      throw new ConflictException('Kullanıcı zaten askıda.');
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Super Admin hesabı askıya alınamaz.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { suspended: true },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.user_suspended',
          resourceType: 'User',
          resourceId: userId,
          metadata: {},
        },
      }),
    ]);
    await this.sessionService.revokeAllUserSessions(userId);
  }

  async unsuspendUser(userId: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.requireActiveUser(userId);
    if (!user.suspended) {
      throw new ConflictException('Kullanıcı askıda değil.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { suspended: false },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.user_unsuspended',
          resourceType: 'User',
          resourceId: userId,
          metadata: {},
        },
      }),
    ]);
  }

  async resetUserPassword(
    userId: string,
    actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    const user = await this.requireActiveUser(userId);
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'admin_password_reset' },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '24h',
      },
    );
    const base = (
      this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com'
    ).replace(/\/$/, '');
    const resetUrl = `${base}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    await this.emailService.sendPasswordReset(user.email, resetUrl);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId,
        impersonatedOrgId: null,
        action: 'admin.user_password_reset',
        resourceType: 'User',
        resourceId: userId,
        metadata: {},
      },
    });
    return { ok: true };
  }

  async revokeUserSessions(userId: string, actor: AuthenticatedUser): Promise<void> {
    await this.requireActiveUser(userId);
    await this.sessionService.revokeAllUserSessions(userId);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId,
        impersonatedOrgId: null,
        action: 'admin.user_sessions_revoked',
        resourceType: 'User',
        resourceId: userId,
        metadata: {},
      },
    });
  }

  async getUserAuditLogs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    logs: {
      id: string;
      action: string;
      resourceType: string;
      resourceId: string | null;
      createdAt: Date;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.requireActiveUser(userId);
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { actorUserId: userId },
        {
          AND: [
            { resourceType: 'User' },
            { resourceId: userId },
          ],
        },
      ],
    };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page: Math.max(page, 1), limit: take };
  }

  async updateUserInfo(
    userId: string,
    dto: UpdateAdminUserDto,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId,
        impersonatedOrgId: null,
        action: 'admin.user_info_updated',
        resourceType: 'User',
        resourceId: userId,
        metadata: {},
      },
    });
  }

  async updateOrganizationInfo(
    orgId: string,
    dto: UpdateAdminOrganizationInfoDto,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.taxId !== undefined ? { taxNumber: dto.taxId } : {}),
        ...(dto.taxOffice !== undefined ? { taxOffice: dto.taxOffice } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId,
        impersonatedOrgId: null,
        action: 'admin.organization_info_updated',
        resourceType: 'Organization',
        resourceId: orgId,
        metadata: {},
      },
    });
  }

  async deleteOrganization(
    orgId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { id: true, slug: true, type: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    if (org.slug === PLATFORM_ORG_SLUG) {
      throw new BadRequestException('Platform organizasyonu silinemez.');
    }
    if (org.id === actor.organizationId) {
      throw new BadRequestException('Kendi organizasyonunuz silinemez.');
    }
    if (org.type === OrgType.PARTNER) {
      throw new BadRequestException(
        'Partner organizasyonları bu ekrandan silinemez. Partner yönetim sayfasını kullanın.',
      );
    }

    const users = await this.prisma.user.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: { deletedAt, suspended: true },
      });
      if (users.length > 0) {
        await tx.user.updateMany({
          where: { organizationId: orgId, deletedAt: null },
          data: { deletedAt },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_deleted',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: { userCount: users.length },
        },
      });
    });

    await Promise.all(
      users.map((u) => this.sessionService.revokeAllUserSessions(u.id)),
    );
  }

  async exportOrgData(orgId: string): Promise<OrgDataExport> {
    await this.requireActiveOrg(orgId);

    const [products, orders, connections] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          barcode: true,
          sku: true,
          name: true,
          brand: true,
          category: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50_000,
      }),
      this.prisma.order.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          platform: true,
          platformOrderId: true,
          status: true,
          customerName: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50_000,
      }),
      this.prisma.marketplaceConnection.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          platform: true,
          isActive: true,
          lastSyncAt: true,
          syncErrorCount: true,
          createdAt: true,
        },
        orderBy: { platform: 'asc' },
      }),
    ]);

    return {
      productsCsv: Papa.unparse(
        products.map((p) => ({
          id: p.id,
          barcode: p.barcode,
          sku: p.sku ?? '',
          name: p.name,
          brand: p.brand ?? '',
          category: p.category ?? '',
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
        })),
      ),
      ordersCsv: Papa.unparse(
        orders.map((o) => ({
          id: o.id,
          platform: o.platform,
          platformOrderId: o.platformOrderId,
          status: o.status,
          customerName: o.customerName,
          totalAmount: o.totalAmount.toString(),
          currency: o.currency,
          createdAt: o.createdAt.toISOString(),
        })),
      ),
      connectionsCsv: Papa.unparse(
        connections.map((c) => ({
          id: c.id,
          platform: c.platform,
          isActive: c.isActive,
          lastSyncAt: c.lastSyncAt?.toISOString() ?? '',
          syncErrorCount: c.syncErrorCount,
          createdAt: c.createdAt.toISOString(),
        })),
      ),
    };
  }

  async exportOrgDataZip(orgId: string): Promise<Buffer> {
    const data = await this.exportOrgData(orgId);
    return zipTextFiles([
      { name: 'urunler.csv', content: data.productsCsv },
      { name: 'siparisler.csv', content: data.ordersCsv },
      { name: 'baglantilar.csv', content: data.connectionsCsv },
    ]);
  }

  async addOrgNote(
    orgId: string,
    adminUserId: string,
    note: string,
  ): Promise<OrgNoteItem> {
    await this.requireActiveOrg(orgId);
    const created = await this.prisma.orgNote.create({
      data: {
        orgId,
        adminId: adminUserId,
        content: note.trim(),
      },
    });
    return created;
  }

  async getOrgNotes(orgId: string): Promise<OrgNoteItem[]> {
    await this.requireActiveOrg(orgId);
    return this.prisma.orgNote.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrgActivitySummary(orgId: string): Promise<ActivitySummary> {
    await this.requireActiveOrg(orgId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [syncCount, orderCount, errorCount] = await Promise.all([
      this.prisma.syncLog.count({
        where: { organizationId: orgId, startedAt: { gte: since } },
      }),
      this.prisma.order.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          createdAt: { gte: since },
        },
      }),
      this.prisma.syncLog.count({
        where: {
          organizationId: orgId,
          startedAt: { gte: since },
          status: { in: [SyncLogStatus.FAILED, SyncLogStatus.PARTIAL] },
        },
      }),
    ]);

    return { syncCount, orderCount, errorCount };
  }

  private async requireActiveUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return user;
  }

  private async requireActiveOrg(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, ...CUSTOMER_ORG_WHERE },
    });
    if (!org) {
      const other = await this.prisma.organization.findFirst({
        where: { id: orgId, deletedAt: null },
        select: { type: true },
      });
      if (other?.type === OrgType.PARTNER) {
        throw new BadRequestException(
          'Partner detayı için Partnerler sayfasını kullanın.',
        );
      }
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
  }

  private async buildPlatformHealth(): Promise<PlatformHealthRow[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        platform: true,
        lastErrorAt: true,
        lastSyncAt: true,
        lastSyncMeta: true,
      },
    });

    const byPlatform = new Map<
      Marketplace,
      { total: number; err24: number; durations: number[]; lastSync: Date | null }
    >();

    for (const p of Object.values(Marketplace)) {
      byPlatform.set(p, {
        total: 0,
        err24: 0,
        durations: [],
        lastSync: null,
      });
    }

    for (const c of connections) {
      const row = byPlatform.get(c.platform);
      if (!row) {
        continue;
      }
      row.total += 1;
      if (c.lastErrorAt && c.lastErrorAt >= since) {
        row.err24 += 1;
      }
      const d = parseDurationMs(c.lastSyncMeta);
      if (d !== null) {
        row.durations.push(d);
      }
      if (c.lastSyncAt) {
        if (!row.lastSync || c.lastSyncAt > row.lastSync) {
          row.lastSync = c.lastSyncAt;
        }
      }
    }

    return Object.values(Marketplace).map((platform) => {
      const row = byPlatform.get(platform)!;
      const errorRate24h = row.total === 0 ? 0 : row.err24 / row.total;
      const averageSyncDurationMs =
        row.durations.length === 0
          ? null
          : Math.round(
              row.durations.reduce((a, b) => a + b, 0) / row.durations.length,
            );
      return {
        platform,
        activeConnections: row.total,
        errorRate24h,
        averageSyncDurationMs,
        lastSyncAt: row.lastSync,
      };
    });
  }
}

async function zipTextFiles(
  files: { name: string; content: string }[],
): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    passthrough.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    passthrough.on('error', reject);
    archive.on('error', reject);
    archive.pipe(passthrough);
    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }
    void archive.finalize();
  });
}
