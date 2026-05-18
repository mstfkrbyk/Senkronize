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
  CommissionLedger,
  CommissionType,
  LedgerStatus,
  PartnerRelationship,
  PartnerStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { ImpersonationService } from '../impersonation/impersonation.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import type { AcceptInviteDto, InviteClientDto, UpdateRelationshipDto } from './partner.dto';

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
    private readonly impersonationService: ImpersonationService,
  ) {}

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
        partnerOrg: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async inviteClient(
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

    if (clientUser?.organization.deletedAt != null) {
      throw new BadRequestException('Bu e-postaya ait organizasyon bulunamadı.');
    }

    if (clientUser) {
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

      const pct = Number(rel.commissionPct);
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
}
