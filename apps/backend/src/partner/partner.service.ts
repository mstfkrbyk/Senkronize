import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommissionLedger,
  LedgerStatus,
  PartnerRelationship,
  PartnerStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import type { AcceptInviteDto, InviteClientDto, UpdateRelationshipDto } from './partner.dto';

@Injectable()
export class PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
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

  async getMyClients(partnerOrgId: string): Promise<PartnerRelationship[]> {
    await this.assertPartnerOrg(partnerOrgId);
    return this.prisma.partnerRelationship.findMany({
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
}
