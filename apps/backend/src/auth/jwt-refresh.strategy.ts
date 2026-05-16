import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt.strategy';

export type JwtRefreshValidatedUser = {
  id: string;
  organizationId: string;
  role: UserRole;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: (req: Request | undefined) => {
        const body = req?.body as { refreshToken?: string } | undefined;
        return body?.refreshToken ?? null;
      },
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<JwtRefreshValidatedUser> {
    const refreshToken = (req.body as { refreshToken?: string } | undefined)
      ?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    const ok = await this.authService.validateRefreshToken(
      payload.sub,
      refreshToken,
    );
    if (!ok) {
      throw new UnauthorizedException();
    }
    return {
      id: payload.sub,
      organizationId: payload.orgId,
      role: payload.role as UserRole,
    };
  }
}
