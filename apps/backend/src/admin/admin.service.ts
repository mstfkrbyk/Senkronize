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
  Marketplace,
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
import { PrismaService } from '../prisma/prisma.service';
import type { AdminUsersQueryDto } from './admin.dto';
import type {
  ActivityItem,
  ActivitySummary,
  AdminOrgListItem,
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

const PLAN_LIMITS: Record<
  PlanTier,
  {
    monthlyOrderLimit: number;
    marketplaceLimit: number;
    ecommerceLimit: number;
    erpLimit: number;
    userLimit: number;
  }
> = {
  BASLANGIC: {
    monthlyOrderLimit: 500,
    marketplaceLimit: 1,
    ecommerceLimit: 1,
    erpLimit: 1,
    userLimit: 2,
  },
  GELISIM: {
    monthlyOrderLimit: 2_000,
    marketplaceLimit: 3,
    ecommerceLimit: 2,
    erpLimit: 2,
    userLimit: 5,
  },
  PRO: {
    monthlyOrderLimit: 10_000,
    marketplaceLimit: 10,
    ecommerceLimit: 5,
    erpLimit: 3,
    userLimit: 15,
  },
  KURUMSAL: {
    monthlyOrderLimit: 100_000,
    marketplaceLimit: 50,
    ecommerceLimit: 20,
    erpLimit: 10,
    userLimit: 100,
  },
};

const ADMIN_ORG_LIST_INCLUDE = Prisma.validator<Prisma.OrganizationInclude>()({
  _count: {
    select: {
      users: { where: { deletedAt: null } },
      marketplaceConnections: { where: { deletedAt: null } },
      orders: { where: { deletedAt: null } },
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
  ) {}

  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = startOfUtcMonth(now);

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
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({
        where: { deletedAt: null, suspended: false },
      }),
      this.prisma.organization.count({
        where: { deletedAt: null, suspended: true },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        where: { organization: { deletedAt: null } },
        _count: { _all: true },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubStatus.TRIAL,
          organization: { deletedAt: null },
          OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }],
        },
      }),
      this.prisma.organization.count({
        where: { deletedAt: null, createdAt: { gte: since30 } },
      }),
      this.prisma.order.count({
        where: {
          deletedAt: null,
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.marketplaceConnection.count({
        where: { isActive: true, deletedAt: null },
      }),
      this.buildPlatformHealth(),
      this.getDailySignupsLast30Days(),
    ]);

    const allTiers = Object.values(PlanTier);
    const planMap = new Map(
      planGroups.map((g) => [g.plan, g._count._all] as const),
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
      trialActiveOrganizations,
      newRegistrationsLast30Days,
      ordersThisMonthCount,
      activeMarketplaceConnections,
      platformHealthScore: computeHealthScore(health),
      dailyNewRegistrations,
    };
  }

  async getRevenueStats(): Promise<RevenueStats> {
    const activeSubs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.ACTIVE,
        organization: { deletedAt: null },
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

  async getDailySignupsLast30Days(): Promise<DailySignupPoint[]> {
    const now = new Date();
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    start.setUTCHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS d, COUNT(*)::bigint AS c
      FROM "Organization"
      WHERE "deletedAt" IS NULL
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
  ): Promise<PaginatedOrganizations> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const s = search?.trim();

    const andParts: Prisma.OrganizationWhereInput[] = [{ deletedAt: null }];

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
      orgs: orgs.map((o) => this.mapOrgListItem(o)),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
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
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const [recentAuditLogs, payments] = await Promise.all([
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
    ]);

    const { subscription, users, marketplaceConnections, orders, ...rest } =
      org;

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
      users,
      marketplaceConnections,
      recentOrders: orders.map((o) => ({
        ...o,
        totalAmount: o.totalAmount.toString(),
      })),
      recentAuditLogs,
      payments,
    };
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
  ): Promise<{ token: string }> {
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

    return { token };
  }

  async getRecentActivity(limit: number): Promise<ActivityItem[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.prisma.auditLog.findMany({
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

    const limits = PLAN_LIMITS[newPlan];

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { organizationId: orgId },
        data: {
          plan: newPlan,
          monthlyOrderLimit: limits.monthlyOrderLimit,
          marketplaceLimit: limits.marketplaceLimit,
          ecommerceLimit: limits.ecommerceLimit,
          erpLimit: limits.erpLimit,
          userLimit: limits.userLimit,
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
    };
  }

  async getUsers(filters: AdminUsersQueryDto): Promise<PaginatedUsers> {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();

    const where: Prisma.UserWhereInput = {
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
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          organization: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        suspended: u.suspended,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        organization: u.organization,
      })),
      total,
      page,
      limit,
    };
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

  async deleteOrganization(
    orgId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: orgId },
        data: { deletedAt: new Date(), suspended: true },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: 'admin.organization_deleted',
          resourceType: 'Organization',
          resourceId: orgId,
          metadata: {},
        },
      }),
    ]);
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
      where: { id: orgId, deletedAt: null },
    });
    if (!org) {
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
