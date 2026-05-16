import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PartnerStatus } from '@prisma/client';

import { JwtPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async startImpersonation(
    partnerUserId: string,
    partnerOrgId: string,
    role: string,
    clientOrgId: string,
  ): Promise<{ impersonationToken: string; expiresIn: number }> {
    const partnerOrg = await this.prisma.organization.findFirst({
      where: { id: partnerOrgId, deletedAt: null },
    });
    if (!partnerOrg || partnerOrg.type !== 'PARTNER') {
      throw new ForbiddenException(
        'Yalnızca partner hesaplar müşteri adına oturum açabilir.',
      );
    }

    const rel = await this.prisma.partnerRelationship.findUnique({
      where: {
        partnerOrgId_clientOrgId: { partnerOrgId, clientOrgId },
      },
    });
    if (
      !rel ||
      rel.status !== PartnerStatus.ACTIVE ||
      !rel.canImpersonate
    ) {
      throw new ForbiddenException(
        'Bu müşteri hesabına erişim izniniz yok.',
      );
    }

    const clientOrg = await this.prisma.organization.findFirst({
      where: { id: clientOrgId, deletedAt: null },
    });
    if (!clientOrg) {
      throw new ForbiddenException('Müşteri organizasyonu bulunamadı.');
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: partnerUserId,
        actorOrgId: partnerOrgId,
        impersonatedOrgId: clientOrgId,
        action: 'partner.impersonation_start',
        resourceType: 'Organization',
        resourceId: clientOrgId,
        metadata: { partnerOrgId },
      },
    });

    const payload: JwtPayload = {
      sub: partnerUserId,
      orgId: partnerOrgId,
      role,
      impersonatedOrgId: clientOrgId,
    };

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const impersonationToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '4h',
    });

    return { impersonationToken, expiresIn: 4 * 60 * 60 };
  }

  async stopImpersonation(
    partnerUserId: string,
    partnerOrgId: string,
    clientOrgId: string,
  ): Promise<void> {
    const rel = await this.prisma.partnerRelationship.findUnique({
      where: {
        partnerOrgId_clientOrgId: { partnerOrgId, clientOrgId },
      },
    });
    if (!rel || rel.partnerOrgId !== partnerOrgId) {
      throw new ForbiddenException();
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: partnerUserId,
        actorOrgId: partnerOrgId,
        impersonatedOrgId: clientOrgId,
        action: 'partner.impersonation_end',
        resourceType: 'Organization',
        resourceId: clientOrgId,
        metadata: {},
      },
    });
  }
}
