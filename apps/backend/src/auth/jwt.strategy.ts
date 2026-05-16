import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: string;
  impersonatedOrgId?: string;
}

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
    return {
      ...user,
      currentOrgId: payload.impersonatedOrgId ?? payload.orgId,
      isImpersonating: !!payload.impersonatedOrgId,
    };
  }
}
