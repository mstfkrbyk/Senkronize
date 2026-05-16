import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartnerStatus } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { organization: true },
    });
    if (!user || user.organization.deletedAt != null) {
      throw new UnauthorizedException();
    }

    if (payload.orgId !== user.organizationId) {
      throw new UnauthorizedException();
    }

    if (payload.impersonatedOrgId) {
      const rel = await this.prisma.partnerRelationship.findUnique({
        where: {
          partnerOrgId_clientOrgId: {
            partnerOrgId: user.organizationId,
            clientOrgId: payload.impersonatedOrgId,
          },
        },
      });
      if (
        !rel ||
        rel.status !== PartnerStatus.ACTIVE ||
        !rel.canImpersonate
      ) {
        throw new UnauthorizedException();
      }
      const clientOrg = await this.prisma.organization.findFirst({
        where: { id: payload.impersonatedOrgId, deletedAt: null },
      });
      if (!clientOrg) {
        throw new UnauthorizedException();
      }
    }

    return {
      ...user,
      currentOrgId: payload.impersonatedOrgId ?? payload.orgId,
      isImpersonating: !!payload.impersonatedOrgId,
    };
  }
}
