import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientOnboarding,
  CommissionLedger,
  CommissionType,
  LedgerStatus,
  PartnerProfile,
  PartnerRelationship,
  PartnerStatus,
  PaymentStatus,
  PlanTier,
  Prisma,
  WhiteLabelSettings,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { ImpersonationService } from '../impersonation/impersonation.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  AcceptInviteDto,
  InviteClientDto,
  UpdateRelationshipDto,
  UpdateWhiteLabelDto,
} from './partner.dto';
import type {
  AdminPartnerRow,
  CommissionReport,
  PartnerPerformance,
} from './partner.types';

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
    private readonly impersonationService: ImpersonationService,
  ) {}

  async getPartnerProfile(partnerOrgId: string): Promise<PartnerProfile> {
    await this.assertPartnerOrg(partnerOrgId);
    return this.prisma.partnerProfile.upsert({
      where: { organizationId: partnerOrgId },
      create: {
        organizationId: partnerOrgId,
        commissionRate: new Prisma.Decimal(10),
      },
      update: {},
    });
  }

  async updatePartnerCommissionRate(
    partnerOrgId: string,
    rate: number,
  ): Promise<PartnerProfile> {
    await this.assertPartnerOrg(partnerOrgId);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      throw new BadRequestException('Komisyon oranı 0–50 arasında olmalıdır.');
    }
    return this.prisma.partnerProfile.upsert({
      where: { organizationId: partnerOrgId },
      create: {
        organizationId: partnerOrgId,
        commissionRate: new Prisma.Decimal(rate),
      },
      update: { commissionRate: new Prisma.Decimal(rate) },
    });
  }

  async listPartnersForAdmin(): Promise<AdminPartnerRow[]> {
    const partners = await this.prisma.organization.findMany({
      where: { type: 'PARTNER', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        partnerProfile: { select: { commissionRate: true } },
        _count: {
          select: {
            partnerRelationships: {
              where: { status: PartnerStatus.ACTIVE, clientOrgId: { not: null } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return partners.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      commissionRate: Number(p.partnerProfile?.commissionRate ?? 10),
      activeClientCount: p._count.partnerRelationships,
      createdAt: p.createdAt,
    }));
  }

  async assertPartnerOrg(partnerOrgId: string): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: partnerOrgId, deletedAt: null },
    });
    if (!org || org.type !== 'PARTNER') {
      throw new ForbiddenException(
        'Yalnızca partner hesaplar bu işlemi yapabilir.',
      );
    }
  }

  async getMyClients(
    partnerOrgId: string,
  ): Promise<
    Array<
      Omit<PartnerRelationship, 'inviteToken'> & {
        inviteUrl: string | null;
      }
    >
  > {
    await this.assertPartnerOrg(partnerOrgId);
    const rows = await this.prisma.partnerRelationship.findMany({
      where: {
        partnerOrgId,
        status: { in: [PartnerStatus.PENDING, PartnerStatus.ACTIVE] },
      },
      include: {
        clientOrg: {
          select: { id: true, name: true, slug: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const baseUrl =
      this.config.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const root = baseUrl.replace(/\/$/, '');
    return rows.map((r) => {
      const { inviteToken, ...rest } = r;
      return {
        ...rest,
        inviteUrl: inviteToken ? `${root}/invite/${inviteToken}` : null,
      };
    });
  }

  async getMyPartners(clientOrgId: string): Promise<PartnerRelationship[]> {
    return this.prisma.partnerRelationship.findMany({
      where: {
        clientOrgId,
        status: { in: [PartnerStatus.PENDING, PartnerStatus.ACTIVE] },
      },
      include: {
        partnerOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
            whiteLabelSettings: {
              select: {
                brandName: true,
                supportEmail: true,
                supportPhone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async inviteClientRelationship(
    partnerOrgId: string,
    dto: InviteClientDto,
  ): Promise<{ inviteUrl: string }> {
    await this.assertPartnerOrg(partnerOrgId);
    const partnerOrg = await this.prisma.organization.findFirstOrThrow({
      where: { id: partnerOrgId, deletedAt: null },
    });

    const email = dto.clientEmail.toLowerCase();
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const commissionPct = new Prisma.Decimal(dto.commissionPct ?? 10);
    const canImpersonate = dto.canImpersonate ?? true;

    const clientUser = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { organization: true },
    });

    if (
      clientUser?.organization &&
      clientUser.organization.deletedAt != null
    ) {
      throw new BadRequestException('Bu e-postaya ait organizasyon bulunamadı.');
    }

    if (clientUser) {
      if (!clientUser.organizationId) {
        throw new BadRequestException(
          'Bu e-posta kayıtlı ancak organizasyon bilgisi eksik.',
        );
      }

      if (clientUser.organizationId === partnerOrgId) {
        throw new BadRequestException('Kendi organizasyonunuzu davet edemezsiniz.');
      }

      const existing = await this.prisma.partnerRelationship.findUnique({
        where: {
          partnerOrgId_clientOrgId: {
            partnerOrgId,
            clientOrgId: clientUser.organizationId,
          },
        },
      });

      if (existing?.status === PartnerStatus.ACTIVE) {
        throw new ConflictException('Bu müşteri ile zaten aktif bir ilişkiniz var.');
      }

      await this.prisma.partnerRelationship.upsert({
        where: {
          partnerOrgId_clientOrgId: {
            partnerOrgId,
            clientOrgId: clientUser.organizationId,
          },
        },
        create: {
          partnerOrgId,
          clientOrgId: clientUser.organizationId,
          invitedEmail: null,
          status: PartnerStatus.PENDING,
          commissionPct,
          canImpersonate,
          inviteToken,
          inviteExpiresAt,
        },
        update: {
          inviteToken,
          inviteExpiresAt,
          status: PartnerStatus.PENDING,
          commissionPct,
          canImpersonate,
          invitedEmail: null,
        },
      });
    } else {
      const pending = await this.prisma.partnerRelationship.findFirst({
        where: {
          partnerOrgId,
          invitedEmail: email,
          clientOrgId: null,
        },
      });

      if (pending) {
        await this.prisma.partnerRelationship.update({
          where: { id: pending.id },
          data: {
            inviteToken,
            inviteExpiresAt,
            commissionPct,
            canImpersonate,
            status: PartnerStatus.PENDING,
          },
        });
      } else {
        await this.prisma.partnerRelationship.create({
          data: {
            partnerOrgId,
            clientOrgId: null,
            invitedEmail: email,
            status: PartnerStatus.PENDING,
            commissionPct,
            canImpersonate,
            inviteToken,
            inviteExpiresAt,
          },
        });
      }
    }

    const baseUrl =
      this.config.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/invite/${inviteToken}`;

    await this.notificationService.dispatch({
      organizationId: partnerOrgId,
      channel: 'email',
      template: 'invite_user',
      payload: {
        email,
        inviterName: partnerOrg.name,
        orgName: partnerOrg.name,
        inviteUrl,
      },
    });

    return { inviteUrl };
  }

  async acceptInvite(
    clientOrgId: string,
    dto: AcceptInviteDto,
  ): Promise<PartnerRelationship> {
    const relationship = await this.prisma.partnerRelationship.findUnique({
      where: { inviteToken: dto.inviteToken },
    });
    if (!relationship) {
      throw new NotFoundException('Davet bulunamadı.');
    }
    if (
      relationship.inviteExpiresAt &&
      relationship.inviteExpiresAt < new Date()
    ) {
      throw new BadRequestException('Davet süresi dolmuş.');
    }
    if (relationship.status === PartnerStatus.TERMINATED) {
      throw new BadRequestException('Bu davet artık geçerli değil.');
    }
    if (relationship.partnerOrgId === clientOrgId) {
      throw new BadRequestException('Geçersiz davet.');
    }

    if (relationship.clientOrgId != null) {
      if (relationship.clientOrgId !== clientOrgId) {
        throw new ForbiddenException('Bu davet başka bir hesaba ait.');
      }
    } else {
      const invited = relationship.invitedEmail?.toLowerCase();
      if (invited) {
        const member = await this.prisma.user.findFirst({
          where: {
            organizationId: clientOrgId,
            email: invited,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!member) {
          throw new ForbiddenException(
            'Davet e-postası bu organizasyondaki hesabınızla eşleşmiyor.',
          );
        }
      }
    }

    return this.prisma.partnerRelationship.update({
      where: { id: relationship.id },
      data: {
        clientOrgId,
        status: PartnerStatus.ACTIVE,
        acceptedAt: new Date(),
        inviteToken: null,
        invitedEmail: null,
      },
    });
  }

  async terminateRelationship(
    orgId: string,
    relationshipId: string,
  ): Promise<void> {
    const rel = await this.prisma.partnerRelationship.findUnique({
      where: { id: relationshipId },
    });
    if (!rel || (rel.partnerOrgId !== orgId && rel.clientOrgId !== orgId)) {
      throw new ForbiddenException();
    }
    await this.prisma.partnerRelationship.update({
      where: { id: relationshipId },
      data: { status: PartnerStatus.TERMINATED },
    });
  }

  async updateRelationship(
    partnerOrgId: string,
    relationshipId: string,
    dto: UpdateRelationshipDto,
  ): Promise<PartnerRelationship> {
    await this.assertPartnerOrg(partnerOrgId);
    const rel = await this.prisma.partnerRelationship.findUnique({
      where: { id: relationshipId },
    });
    if (!rel || rel.partnerOrgId !== partnerOrgId) {
      throw new ForbiddenException();
    }
    const data: Prisma.PartnerRelationshipUpdateInput = {};
    if (dto.commissionPct !== undefined) {
      data.commissionPct = new Prisma.Decimal(dto.commissionPct);
    }
    if (dto.canImpersonate !== undefined) {
      data.canImpersonate = dto.canImpersonate;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    return this.prisma.partnerRelationship.update({
      where: { id: relationshipId },
      data,
    });
  }

  async getCommissionSummary(partnerOrgId: string): Promise<{
    totalEarned: number;
    pendingAmount: number;
    settledAmount: number;
    activeClients: number;
    ledger: CommissionLedger[];
  }> {
    await this.assertPartnerOrg(partnerOrgId);

    const [pendingSum, settledSum, activeClients, ledger] = await Promise.all([
      this.prisma.commissionLedger.aggregate({
        where: { partnerOrgId, status: LedgerStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.commissionLedger.aggregate({
        where: { partnerOrgId, status: LedgerStatus.SETTLED },
        _sum: { amount: true },
      }),
      this.prisma.partnerRelationship.count({
        where: { partnerOrgId, status: PartnerStatus.ACTIVE },
      }),
      this.prisma.commissionLedger.findMany({
        where: { partnerOrgId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const pendingAmount = Number(pendingSum._sum.amount ?? 0);
    const settledAmount = Number(settledSum._sum.amount ?? 0);

    return {
      totalEarned: pendingAmount + settledAmount,
      pendingAmount,
      settledAmount,
      activeClients,
      ledger,
    };
  }

  async getDashboard(partnerOrgId: string): Promise<{
    totalClients: number;
    activeClients30d: number;
    monthlyCommission: number;
    totalCommission: number;
    commissionPctSummary: { min: number; max: number; unique: number[] };
    recentActivities: Array<{
      happenedAt: string;
      title: string;
      detail: string | null;
    }>;
    clients: Array<{
      relationshipId: string;
      clientOrgId: string;
      name: string;
      slug: string;
      status: PartnerStatus;
      commissionPct: number;
      canImpersonate: boolean;
      connectionCount: number;
      orders30d: number;
    }>;
  }> {
    await this.assertPartnerOrg(partnerOrgId);

    const relationships = await this.prisma.partnerRelationship.findMany({
      where: { partnerOrgId, status: PartnerStatus.ACTIVE },
      include: {
        clientOrg: { select: { id: true, name: true, slug: true } },
      },
    });

    const withClient = relationships.filter(
      (r): r is typeof r & { clientOrgId: string; clientOrg: NonNullable<typeof r.clientOrg> } =>
        r.clientOrgId != null && r.clientOrg != null,
    );

    const totalClients = withClient.length;
    const pctValues = withClient.map((r) => Number(r.commissionPct));
    const uniquePct = [...new Set(pctValues)].sort((a, b) => a - b);
    const commissionPctSummary = {
      min: uniquePct.length ? Math.min(...uniquePct) : 0,
      max: uniquePct.length ? Math.max(...uniquePct) : 0,
      unique: uniquePct,
    };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const clientIds = withClient.map((r) => r.clientOrgId);

    const [
      monthlyAgg,
      totalAgg,
      connGroups,
      orderGroups,
      recentLedger,
      recentAudits,
    ] = await Promise.all([
      this.prisma.commissionLedger.aggregate({
        where: {
          partnerOrgId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.commissionLedger.aggregate({
        where: { partnerOrgId },
        _sum: { amount: true },
      }),
      clientIds.length
        ? this.prisma.marketplaceConnection.groupBy({
            by: ['organizationId'],
            where: {
              organizationId: { in: clientIds },
              isActive: true,
              deletedAt: null,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      clientIds.length
        ? this.prisma.order.groupBy({
            by: ['organizationId'],
            where: {
              organizationId: { in: clientIds },
              deletedAt: null,
              createdAt: { gte: thirtyDaysAgo },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.prisma.commissionLedger.findMany({
        where: { partnerOrgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          clientOrg: { select: { name: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { actorOrgId: partnerOrgId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          action: true,
          createdAt: true,
          resourceType: true,
          impersonatedOrgId: true,
        },
      }),
    ]);

    const connMap = new Map(
      connGroups.map((g) => [g.organizationId, g._count._all]),
    );
    const orderMap = new Map(
      orderGroups.map((g) => [g.organizationId, g._count._all]),
    );

    const activeClients30d = [...orderMap.values()].filter((c) => c > 0)
      .length;

    const clients = withClient.map((r) => ({
      relationshipId: r.id,
      clientOrgId: r.clientOrgId,
      name: r.clientOrg.name,
      slug: r.clientOrg.slug,
      status: r.status,
      commissionPct: Number(r.commissionPct),
      canImpersonate: r.canImpersonate,
      connectionCount: connMap.get(r.clientOrgId) ?? 0,
      orders30d: orderMap.get(r.clientOrgId) ?? 0,
    }));

    type Activity = {
      happenedAt: string;
      title: string;
      detail: string | null;
    };

    const commissionActivities: Activity[] = recentLedger.map((row) => ({
      happenedAt: row.createdAt.toISOString(),
      title: 'Komisyon kaydı',
      detail: `${row.clientOrg.name}: ${row.description ?? row.type}`,
    }));

    const auditTitle = (action: string): string => {
      if (action === 'partner.impersonation_start') {
        return 'Müşteri hesabına erişim';
      }
      if (action === 'partner.impersonation_end') {
        return 'Müşteri oturumu sonlandı';
      }
      return action;
    };

    const auditActivities: Activity[] = recentAudits.map((a) => ({
      happenedAt: a.createdAt.toISOString(),
      title: auditTitle(a.action),
      detail: null,
    }));

    const merged = [...commissionActivities, ...auditActivities]
      .sort(
        (a, b) =>
          new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
      )
      .slice(0, 5);

    return {
      totalClients,
      activeClients30d,
      monthlyCommission: Number(monthlyAgg._sum.amount ?? 0),
      totalCommission: Number(totalAgg._sum.amount ?? 0),
      commissionPctSummary,
      recentActivities: merged,
      clients,
    };
  }

  async getCommissions(
    partnerOrgId: string,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<
      CommissionLedger & {
        clientOrg: { name: string };
      }
    >;
    total: number;
    page: number;
    limit: number;
    currentMonthTotal: number;
  }> {
    await this.assertPartnerOrg(partnerOrgId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [items, total, monthAgg] = await Promise.all([
      this.prisma.commissionLedger.findMany({
        where: { partnerOrgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          clientOrg: { select: { name: true } },
        },
      }),
      this.prisma.commissionLedger.count({ where: { partnerOrgId } }),
      this.prisma.commissionLedger.aggregate({
        where: {
          partnerOrgId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      currentMonthTotal: Number(monthAgg._sum.amount ?? 0),
    };
  }

  async getClientDetail(
    partnerOrgId: string,
    clientOrgId: string,
  ): Promise<{
    clientOrgId: string;
    name: string;
    slug: string;
    connections: number;
    recentOrders30d: number;
  }> {
    await this.assertPartnerOrg(partnerOrgId);
    const rel = await this.prisma.partnerRelationship.findFirst({
      where: {
        partnerOrgId,
        clientOrgId,
        status: PartnerStatus.ACTIVE,
      },
    });
    if (!rel) {
      throw new ForbiddenException();
    }

    const client = await this.prisma.organization.findFirst({
      where: { id: clientOrgId, deletedAt: null },
      select: { name: true, slug: true },
    });
    if (!client) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [connections, recentOrders] = await Promise.all([
      this.prisma.marketplaceConnection.count({
        where: {
          organizationId: clientOrgId,
          isActive: true,
          deletedAt: null,
        },
      }),
      this.prisma.order.count({
        where: {
          organizationId: clientOrgId,
          deletedAt: null,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return {
      clientOrgId,
      name: client.name,
      slug: client.slug,
      connections,
      recentOrders30d: recentOrders,
    };
  }

  async startClientAccess(
    partnerOrgId: string,
    clientOrgId: string,
    userId: string,
    role: string,
  ): Promise<{ impersonationToken: string; expiresIn: number }> {
    await this.assertPartnerOrg(partnerOrgId);
    return this.impersonationService.startImpersonation(
      userId,
      partnerOrgId,
      role,
      clientOrgId,
    );
  }

  /** Abonelik ödemesi sonrası partner komisyonu (idempotent, paymentId ile). */
  async recordCommission(
    clientOrgId: string,
    paymentAmountTry: number,
    description: string,
    paymentId: string,
  ): Promise<void> {
    try {
      const rel = await this.prisma.partnerRelationship.findFirst({
        where: { clientOrgId, status: PartnerStatus.ACTIVE },
      });
      if (!rel) {
        return;
      }

      const profile = await this.getPartnerProfile(rel.partnerOrgId);
      const pct = Number(profile.commissionRate);
      if (!Number.isFinite(pct) || pct <= 0) {
        return;
      }

      const existing = await this.prisma.commissionLedger.findFirst({
        where: {
          referenceId: `${paymentId}:${rel.partnerOrgId}`,
          type: CommissionType.SUBSCRIPTION_FEE,
        },
      });
      if (existing) {
        return;
      }

      const commissionAmount = new Prisma.Decimal(
        (paymentAmountTry * pct) / 100,
      );

      await this.prisma.commissionLedger.create({
        data: {
          partnerOrgId: rel.partnerOrgId,
          clientOrgId,
          amount: commissionAmount,
          type: CommissionType.SUBSCRIPTION_FEE,
          description,
          status: LedgerStatus.PENDING,
          referenceId: `${paymentId}:${rel.partnerOrgId}`,
        },
      });
    } catch (error) {
      this.logger.error('Partner komisyon kaydı oluşturulamadı', {
        clientOrgId,
        paymentId,
        error,
      });
    }
  }

  async inviteClient(
    partnerOrgId: string,
    email: string,
    message?: string,
  ): Promise<Omit<ClientOnboarding, 'inviteToken'> & { inviteUrl: string }> {
    await this.assertPartnerOrg(partnerOrgId);
    const partnerOrg = await this.prisma.organization.findFirstOrThrow({
      where: { id: partnerOrgId, deletedAt: null },
    });

    const inviteEmail = email.toLowerCase().trim();
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const existing = await this.prisma.clientOnboarding.findFirst({
      where: {
        organizationId: partnerOrgId,
        inviteEmail,
        status: 'INVITED',
      },
    });

    const row = existing
      ? await this.prisma.clientOnboarding.update({
          where: { id: existing.id },
          data: {
            inviteToken,
            inviteExpiresAt,
            status: 'INVITED',
            clientOrgId: null,
            completedAt: null,
          },
        })
      : await this.prisma.clientOnboarding.create({
          data: {
            organizationId: partnerOrgId,
            inviteEmail,
            inviteToken,
            inviteExpiresAt,
            status: 'INVITED',
          },
        });

    const baseUrl =
      this.config.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const registerUrl = `${baseUrl.replace(/\/$/, '')}/register?invite=${encodeURIComponent(inviteToken)}`;

    await this.notificationService.dispatch({
      organizationId: partnerOrgId,
      channel: 'email',
      template: 'invite_user',
      payload: {
        email: inviteEmail,
        inviterName: partnerOrg.name,
        orgName: partnerOrg.name,
        inviteUrl: registerUrl,
        customMessage: message?.trim() || '',
      },
    });

    const { inviteToken: _t, ...rest } = row;
    void _t;
    return { ...rest, inviteUrl: registerUrl };
  }

  async getInvites(partnerOrgId: string  ): Promise<
    Array<
      Omit<ClientOnboarding, 'inviteToken'> & {
        inviteUrl: string;
        displayStatus: string;
        expired: boolean;
      }
    >
  > {
    await this.assertPartnerOrg(partnerOrgId);
    const rows = await this.prisma.clientOnboarding.findMany({
      where: { organizationId: partnerOrgId },
      orderBy: { createdAt: 'desc' },
    });
    const baseUrl =
      this.config.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const root = baseUrl.replace(/\/$/, '');
    const now = new Date();
    return rows.map((r) => {
      const { inviteToken: _tok, ...rest } = r;
      void _tok;
      const expired = r.inviteExpiresAt < now && r.status === 'INVITED';
      let displayStatus = r.status;
      if (expired) {
        displayStatus = 'EXPIRED';
      } else if (r.status === 'INVITED') {
        displayStatus = 'INVITED';
      } else if (r.status === 'REGISTERED') {
        displayStatus = 'REGISTERED';
      } else if (r.status === 'ONBOARDED') {
        displayStatus = 'ONBOARDED';
      } else if (r.status === 'ACTIVE') {
        displayStatus = 'ACTIVE';
      }
      return {
        ...rest,
        inviteUrl: `${root}/register?invite=${encodeURIComponent(r.inviteToken)}`,
        displayStatus,
        expired,
      };
    });
  }

  async validateInviteToken(
    token: string,
  ): Promise<{ partnerOrgId: string; email: string; partnerName: string }> {
    const row = await this.prisma.clientOnboarding.findUnique({
      where: { inviteToken: token },
      include: { organization: { select: { name: true } } },
    });
    if (!row) {
      throw new NotFoundException('Davet bulunamadı.');
    }
    if (row.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Davet süresi dolmuş.');
    }
    if (row.status !== 'INVITED' && row.status !== 'REGISTERED') {
      throw new BadRequestException('Bu davet artık kullanılamaz.');
    }
    return {
      partnerOrgId: row.organizationId,
      email: row.inviteEmail,
      partnerName: row.organization.name,
    };
  }

  async completeClientOnboarding(
    token: string,
    clientOrgId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const row = await db.clientOnboarding.findUnique({
      where: { inviteToken: token },
    });
    if (!row) {
      throw new NotFoundException('Davet bulunamadı.');
    }
    if (row.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Davet süresi dolmuş.');
    }
    if (row.status === 'ACTIVE') {
      return;
    }
    if (row.status !== 'INVITED' && row.status !== 'REGISTERED') {
      throw new BadRequestException('Bu davet artık kullanılamaz.');
    }

    await db.clientOnboarding.update({
      where: { id: row.id },
      data: {
        clientOrgId,
        status: 'ACTIVE',
        completedAt: new Date(),
      },
    });

    await db.partnerRelationship.upsert({
      where: {
        partnerOrgId_clientOrgId: {
          partnerOrgId: row.organizationId,
          clientOrgId,
        },
      },
      create: {
        partnerOrgId: row.organizationId,
        clientOrgId,
        status: PartnerStatus.ACTIVE,
        commissionPct: new Prisma.Decimal(10),
        canImpersonate: true,
        acceptedAt: new Date(),
      },
      update: {
        status: PartnerStatus.ACTIVE,
        acceptedAt: new Date(),
        inviteToken: null,
        invitedEmail: null,
      },
    });
  }

  async resendClientInvite(
    partnerOrgId: string,
    onboardingId: string,
  ): Promise<{ inviteUrl: string }> {
    await this.assertPartnerOrg(partnerOrgId);
    const row = await this.prisma.clientOnboarding.findFirst({
      where: { id: onboardingId, organizationId: partnerOrgId },
    });
    if (!row) {
      throw new NotFoundException('Davet bulunamadı.');
    }
    if (row.status !== 'INVITED') {
      throw new BadRequestException('Yalnızca bekleyen davetler yeniden gönderilebilir.');
    }
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.clientOnboarding.update({
      where: { id: row.id },
      data: { inviteToken, inviteExpiresAt },
    });
    const partnerOrg = await this.prisma.organization.findFirstOrThrow({
      where: { id: partnerOrgId, deletedAt: null },
    });
    const baseUrl =
      this.config.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const registerUrl = `${baseUrl.replace(/\/$/, '')}/register?invite=${encodeURIComponent(inviteToken)}`;
    await this.notificationService.dispatch({
      organizationId: partnerOrgId,
      channel: 'email',
      template: 'invite_user',
      payload: {
        email: row.inviteEmail,
        inviterName: partnerOrg.name,
        orgName: partnerOrg.name,
        inviteUrl: registerUrl,
      },
    });
    return { inviteUrl: registerUrl };
  }

  async getCommissionReport(
    partnerOrgId: string,
    year: number,
    month: number,
  ): Promise<CommissionReport> {
    await this.assertPartnerOrg(partnerOrgId);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = new Date(year, month - 1, 1);

    const relationships = await this.prisma.partnerRelationship.findMany({
      where: { partnerOrgId, status: PartnerStatus.ACTIVE, clientOrgId: { not: null } },
      include: {
        clientOrg: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });

    const clientIds = relationships
      .filter((r) => r.clientOrgId && r.clientOrg?.deletedAt == null)
      .map((r) => r.clientOrgId as string);

    const [ledgerMonth, ledgerPrev, pendingAgg, settledAgg, paymentsMonth] =
      await Promise.all([
        this.prisma.commissionLedger.groupBy({
          by: ['clientOrgId'],
          where: {
            partnerOrgId,
            createdAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        }),
        this.prisma.commissionLedger.groupBy({
          by: ['clientOrgId'],
          where: {
            partnerOrgId,
            createdAt: { gte: prevStart, lt: prevEnd },
          },
          _sum: { amount: true },
        }),
        this.prisma.commissionLedger.aggregate({
          where: { partnerOrgId, status: LedgerStatus.PENDING },
          _sum: { amount: true },
        }),
        this.prisma.commissionLedger.aggregate({
          where: { partnerOrgId, status: LedgerStatus.SETTLED },
          _sum: { amount: true },
        }),
        clientIds.length
          ? this.prisma.payment.groupBy({
              by: ['organizationId'],
              where: {
                organizationId: { in: clientIds },
                status: PaymentStatus.SUCCESS,
                createdAt: { gte: start, lt: end },
              },
              _sum: { amount: true },
            })
          : Promise.resolve([]),
      ]);

    const ledgerMap = new Map(
      ledgerMonth.map((g) => [g.clientOrgId, Number(g._sum.amount ?? 0)]),
    );
    const paymentMap = new Map(
      paymentsMonth.map((p) => [
        p.organizationId,
        Number(p._sum.amount ?? 0) / 100,
      ]),
    );

    const subs = clientIds.length
      ? await this.prisma.subscription.findMany({
          where: { organizationId: { in: clientIds } },
          select: { organizationId: true, plan: true },
        })
      : [];
    const planByOrg = new Map(subs.map((s) => [s.organizationId, s.plan]));

    const rows: CommissionReport['rows'] = relationships
      .filter((r) => r.clientOrgId && r.clientOrg)
      .map((r) => {
        const cid = r.clientOrgId as string;
        const commissionAmountTRY = ledgerMap.get(cid) ?? 0;
        const monthlyFeeTRY = paymentMap.get(cid) ?? 0;
        const commissionPct = Number(r.commissionPct);
        return {
          clientOrgId: cid,
          clientName: r.clientOrg!.name,
          plan: planByOrg.get(cid) ?? PlanTier.GELISIM,
          monthlyFeeTRY,
          commissionPct,
          commissionAmountTRY,
        };
      });

    const monthTotal = [...ledgerMap.values()].reduce((a, b) => a + b, 0);
    const previousMonthTotal = ledgerPrev.reduce(
      (acc, g) => acc + Number(g._sum.amount ?? 0),
      0,
    );

    const trendLast6Months: CommissionReport['trendLast6Months'] = await Promise.all(
      Array.from({ length: 6 }, async (_, idx) => {
        const i = 5 - idx;
        const d = new Date(year, month - 1 - i, 1);
        const ys = d.getFullYear();
        const ms = d.getMonth() + 1;
        const s = new Date(ys, ms - 1, 1);
        const e = new Date(ys, ms, 1);
        const agg = await this.prisma.commissionLedger.aggregate({
          where: {
            partnerOrgId,
            createdAt: { gte: s, lt: e },
          },
          _sum: { amount: true },
        });
        return {
          year: ys,
          month: ms,
          label: `${ms.toString().padStart(2, '0')}/${ys}`,
          total: Number(agg._sum.amount ?? 0),
        };
      }),
    );

    return {
      year,
      month,
      rows,
      monthTotal,
      previousMonthTotal,
      lifetimePending: Number(pendingAgg._sum.amount ?? 0),
      lifetimeSettled: Number(settledAgg._sum.amount ?? 0),
      trendLast6Months,
    };
  }

  async getWhiteLabelSettings(
    orgId: string,
  ): Promise<WhiteLabelSettings | null> {
    await this.assertPartnerOrg(orgId);
    return this.prisma.whiteLabelSettings.findUnique({
      where: { organizationId: orgId },
    });
  }

  async updateWhiteLabelSettings(
    orgId: string,
    dto: UpdateWhiteLabelDto,
  ): Promise<WhiteLabelSettings> {
    await this.assertPartnerOrg(orgId);
    const data: Prisma.WhiteLabelSettingsUncheckedUpdateInput = {};
    if (dto.brandName !== undefined) {
      data.brandName = dto.brandName.trim() || null;
    }
    if (dto.logoUrl !== undefined) {
      data.logoUrl = dto.logoUrl.trim() || null;
    }
    if (dto.primaryColor !== undefined) {
      data.primaryColor = dto.primaryColor.trim() || null;
    }
    if (dto.supportEmail !== undefined) {
      data.supportEmail = dto.supportEmail.trim() || null;
    }
    if (dto.supportPhone !== undefined) {
      data.supportPhone = dto.supportPhone.trim() || null;
    }
    if (dto.customDomain !== undefined) {
      data.customDomain = dto.customDomain.trim() || null;
    }
    if (dto.hideSenkronize !== undefined) {
      data.hideSenkronize = dto.hideSenkronize;
    }
    return this.prisma.whiteLabelSettings.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        brandName: dto.brandName?.trim() ?? null,
        logoUrl: dto.logoUrl?.trim() ?? null,
        primaryColor: dto.primaryColor?.trim() ?? null,
        supportEmail: dto.supportEmail?.trim() ?? null,
        supportPhone: dto.supportPhone?.trim() ?? null,
        customDomain: dto.customDomain?.trim() ?? null,
        hideSenkronize: dto.hideSenkronize ?? false,
      },
      update: data,
    });
  }

  async requestPayout(
    partnerOrgId: string,
    actorUserId: string,
    amount: number,
  ): Promise<void> {
    await this.assertPartnerOrg(partnerOrgId);
    if (!Number.isFinite(amount) || amount < 1) {
      throw new BadRequestException('Geçersiz tutar.');
    }
    const pending = await this.prisma.commissionLedger.aggregate({
      where: { partnerOrgId, status: LedgerStatus.PENDING },
      _sum: { amount: true },
    });
    const pendingAmount = Number(pending._sum.amount ?? 0);
    if (amount > pendingAmount) {
      throw new BadRequestException(
        'Talep tutarı bekleyen komisyon bakiyesinden fazla olamaz.',
      );
    }
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        actorOrgId: partnerOrgId,
        action: 'partner.payout_request',
        resourceType: 'Partner',
        resourceId: partnerOrgId,
        metadata: {
          amountTRY: amount,
        },
      },
    });
  }

  async getPartnerPerformance(partnerOrgId: string): Promise<PartnerPerformance> {
    await this.assertPartnerOrg(partnerOrgId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const relationships = await this.prisma.partnerRelationship.findMany({
      where: { partnerOrgId, status: PartnerStatus.ACTIVE, clientOrgId: { not: null } },
      include: { clientOrg: { select: { id: true, name: true } } },
    });

    const clientIds = relationships
      .map((r) => r.clientOrgId)
      .filter((id): id is string => id != null);

    const [newOnboardings, ledgerMonth, ledgerByClient] = await Promise.all([
      this.prisma.clientOnboarding.count({
        where: {
          organizationId: partnerOrgId,
          status: 'ACTIVE',
          completedAt: { gte: startOfMonth },
        },
      }),
      this.prisma.commissionLedger.aggregate({
        where: { partnerOrgId, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      clientIds.length
        ? this.prisma.commissionLedger.groupBy({
            by: ['clientOrgId'],
            where: {
              partnerOrgId,
              createdAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const totalActiveClients = clientIds.length;
    const monthTotal = Number(ledgerMonth._sum.amount ?? 0);
    const avgCommissionPerClientTRY =
      totalActiveClients > 0 ? monthTotal / totalActiveClients : 0;

    const nameById = new Map(
      relationships
        .filter((r) => r.clientOrg)
        .map((r) => [r.clientOrgId as string, r.clientOrg!.name]),
    );

    const topProfitableClients = [...ledgerByClient]
      .map((g) => ({
        clientOrgId: g.clientOrgId,
        name: nameById.get(g.clientOrgId) ?? 'Müşteri',
        commissionThisMonthTRY: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.commissionThisMonthTRY - a.commissionThisMonthTRY)
      .slice(0, 8);

    return {
      totalActiveClients,
      newClientsThisMonth: newOnboardings,
      avgCommissionPerClientTRY,
      topProfitableClients,
    };
  }
}
