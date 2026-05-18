import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PartnerStatus, UserRole } from '@prisma/client';
import * as Sentry from '@sentry/node';
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

    if (
      user.organization.suspended &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new UnauthorizedException();
    }

    if (payload.orgId !== user.organizationId) {
      throw new UnauthorizedException();
    }

    if (payload.impersonatedOrgId) {
      if (user.role === UserRole.SUPER_ADMIN) {
        const clientOrg = await this.prisma.organization.findFirst({
          where: { id: payload.impersonatedOrgId, deletedAt: null },
        });
        if (!clientOrg) {
          throw new UnauthorizedException();
        }
      } else {
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
    }

    if (process.env.SENTRY_DSN?.trim()) {
      const effectiveOrgId = payload.impersonatedOrgId ?? payload.orgId;
      Sentry.setUser({ id: user.id, email: user.email });
      Sentry.setTag('organizationId', effectiveOrgId);
    }

    return {
      ...user,
      currentOrgId: payload.impersonatedOrgId ?? payload.orgId,
      isImpersonating: !!payload.impersonatedOrgId,
    };
  }
}
