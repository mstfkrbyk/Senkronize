import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PartnerLinkStatus,
  PartnerLinkRequest,
  PartnerStatus,
  UserRole,
} from '@prisma/client';

import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { PartnerService } from './partner.service';
import type { PartnerListItem } from './partner.types';

@Injectable()
export class PartnerLinkService {
  private readonly logger = new Logger(PartnerLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerService: PartnerService,
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  async getAvailablePartners(clientOrgId: string): Promise<PartnerListItem[]> {
    const [activeRels, pendingLinkRequests, partners] = await Promise.all([
      this.prisma.partnerRelationship.findMany({
        where: {
          clientOrgId,
          status: { in: [PartnerStatus.ACTIVE, PartnerStatus.PENDING] },
        },
        select: { partnerOrgId: true },
      }),
      this.prisma.partnerLinkRequest.findMany({
        where: { clientOrgId, status: PartnerLinkStatus.PENDING },
        select: { partnerOrgId: true },
      }),
      this.prisma.organization.findMany({
        where: { type: 'PARTNER', deletedAt: null, suspended: false },
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
          _count: {
            select: {
              partnerRelationships: {
                where: { status: PartnerStatus.ACTIVE, clientOrgId: { not: null } },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const excluded = new Set(activeRels.map((r) => r.partnerOrgId));
    const pendingSet = new Set(pendingLinkRequests.map((r) => r.partnerOrgId));

    return partners
      .filter((p) => !excluded.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.whiteLabelSettings?.brandName ?? p.name,
        slug: p.slug,
        description:
          p.whiteLabelSettings?.brandName != null
            ? `${p.name} — beyaz etiket partner`
            : 'Senkronize partner ağı üyesi',
        activeClientCount: p._count.partnerRelationships,
        supportEmail: p.whiteLabelSettings?.supportEmail ?? null,
        supportPhone: p.whiteLabelSettings?.supportPhone ?? null,
        hasPendingRequest: pendingSet.has(p.id),
      }));
  }

  async getClientLinkRequests(
    clientOrgId: string,
  ): Promise<Pick<PartnerLinkRequest, 'id' | 'partnerOrgId' | 'status' | 'requestedAt'>[]> {
    return this.prisma.partnerLinkRequest.findMany({
      where: { clientOrgId },
      select: {
        id: true,
        partnerOrgId: true,
        status: true,
        requestedAt: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async requestPartnerLink(
    clientOrgId: string,
    partnerOrgId: string,
    message?: string,
  ): Promise<void> {
    if (clientOrgId === partnerOrgId) {
      throw new BadRequestException('Kendi organizasyonunuza bağlanamazsınız.');
    }

    const partner = await this.prisma.organization.findFirst({
      where: { id: partnerOrgId, type: 'PARTNER', deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException('Partner bulunamadı.');
    }

    const activeRel = await this.prisma.partnerRelationship.findFirst({
      where: {
        clientOrgId,
        partnerOrgId,
        status: { in: [PartnerStatus.ACTIVE, PartnerStatus.PENDING] },
      },
    });
    if (activeRel) {
      throw new ConflictException('Bu partner ile zaten bir ilişkiniz var.');
    }

    const existing = await this.prisma.partnerLinkRequest.findUnique({
      where: {
        clientOrgId_partnerOrgId: { clientOrgId, partnerOrgId },
      },
    });
    if (existing?.status === PartnerLinkStatus.PENDING) {
      throw new ConflictException('Bu partner için zaten bekleyen bir talebiniz var.');
    }
    if (existing?.status === PartnerLinkStatus.APPROVED) {
      throw new ConflictException('Bu partner ile bağlantınız zaten onaylanmış.');
    }

    const client = await this.prisma.organization.findFirstOrThrow({
      where: { id: clientOrgId, deletedAt: null },
      select: { name: true },
    });

    await this.prisma.partnerLinkRequest.upsert({
      where: {
        clientOrgId_partnerOrgId: { clientOrgId, partnerOrgId },
      },
      create: {
        clientOrgId,
        partnerOrgId,
        message: message?.trim() || null,
        status: PartnerLinkStatus.PENDING,
        adminNote: null,
        reviewedAt: null,
        reviewedBy: null,
      },
      update: {
        message: message?.trim() || null,
        status: PartnerLinkStatus.PENDING,
        adminNote: null,
        reviewedAt: null,
        reviewedBy: null,
        requestedAt: new Date(),
      },
    });

    await this.notifySuperAdmins({
      title: 'Yeni partner bağlantı talebi',
      message: `${client.name} → ${partner.name} bağlantı talebi gönderdi.`,
      link: '/admin/partner-link-requests',
      metadata: { clientOrgId, partnerOrgId },
    });
  }

  async getLinkRequests(
    status?: PartnerLinkStatus,
  ): Promise<
    Array<
      PartnerLinkRequest & {
        clientOrg: { id: string; name: string; slug: string };
        partnerOrg: { id: string; name: string; slug: string };
      }
    >
  > {
    return this.prisma.partnerLinkRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        clientOrg: { select: { id: true, name: true, slug: true } },
        partnerOrg: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async countPendingLinkRequests(): Promise<number> {
    return this.prisma.partnerLinkRequest.count({
      where: { status: PartnerLinkStatus.PENDING },
    });
  }

  async approveLinkRequest(requestId: string, adminUserId: string): Promise<void> {
    const request = await this.prisma.partnerLinkRequest.findUnique({
      where: { id: requestId },
      include: {
        clientOrg: { select: { name: true } },
        partnerOrg: { select: { name: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Bağlantı talebi bulunamadı.');
    }
    if (request.status !== PartnerLinkStatus.PENDING) {
      throw new BadRequestException('Bu talep zaten işlenmiş.');
    }

    const profile = await this.partnerService.getPartnerProfile(
      request.partnerOrgId,
    );
    const commissionPct = profile.commissionRate;

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerLinkRequest.update({
        where: { id: requestId },
        data: {
          status: PartnerLinkStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
        },
      });

      const existing = await tx.partnerRelationship.findUnique({
        where: {
          partnerOrgId_clientOrgId: {
            partnerOrgId: request.partnerOrgId,
            clientOrgId: request.clientOrgId,
          },
        },
      });

      if (existing?.status === PartnerStatus.ACTIVE) {
        return;
      }

      await tx.partnerRelationship.upsert({
        where: {
          partnerOrgId_clientOrgId: {
            partnerOrgId: request.partnerOrgId,
            clientOrgId: request.clientOrgId,
          },
        },
        create: {
          partnerOrgId: request.partnerOrgId,
          clientOrgId: request.clientOrgId,
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
    });

    await Promise.all([
      this.inAppNotificationService.create({
        organizationId: request.clientOrgId,
        type: NotificationType.SYSTEM,
        title: 'Partner bağlantınız onaylandı',
        message: `${request.partnerOrg.name} ile bağlantınız admin tarafından onaylandı.`,
        link: '/settings?tab=partners',
      }),
      this.inAppNotificationService.create({
        organizationId: request.partnerOrgId,
        type: NotificationType.SYSTEM,
        title: 'Yeni müşteri bağlandı',
        message: `${request.clientOrg.name} hesabı partner ağınıza eklendi.`,
        link: '/partner',
      }),
    ]);
  }

  async rejectLinkRequest(
    requestId: string,
    adminUserId: string,
    note?: string,
  ): Promise<void> {
    const request = await this.prisma.partnerLinkRequest.findUnique({
      where: { id: requestId },
      include: { clientOrg: { select: { name: true } } },
    });
    if (!request) {
      throw new NotFoundException('Bağlantı talebi bulunamadı.');
    }
    if (request.status !== PartnerLinkStatus.PENDING) {
      throw new BadRequestException('Bu talep zaten işlenmiş.');
    }

    await this.prisma.partnerLinkRequest.update({
      where: { id: requestId },
      data: {
        status: PartnerLinkStatus.REJECTED,
        adminNote: note?.trim() || null,
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
      },
    });

    await this.inAppNotificationService.create({
      organizationId: request.clientOrgId,
      type: NotificationType.SYSTEM,
      title: 'Partner bağlantı talebi reddedildi',
      message: note?.trim()
        ? `Talebiniz reddedildi: ${note.trim()}`
        : 'Partner bağlantı talebiniz admin tarafından reddedildi.',
      link: '/settings/partners',
    });
  }

  private async notifySuperAdmins(params: {
    title: string;
    message: string;
    link: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
      select: { id: true, organizationId: true },
    });

    await Promise.all(
      admins
        .filter((a) => a.organizationId != null)
        .map((admin) =>
          this.inAppNotificationService
            .create({
              organizationId: admin.organizationId!,
              userId: admin.id,
              type: NotificationType.SYSTEM,
              title: params.title,
              message: params.message,
              link: params.link,
              metadata: params.metadata,
            })
            .catch((error) => {
              this.logger.warn('Admin bildirimi oluşturulamadı', {
                adminUserId: admin.id,
                error,
              });
            }),
        ),
    );
  }
}
