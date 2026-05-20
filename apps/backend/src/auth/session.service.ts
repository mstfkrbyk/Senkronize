import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { IpGeolocationService } from '../security/ip-geolocation.service';
import { PrismaService } from '../prisma/prisma.service';

import { parseDeviceInfo, type SessionMetaInput } from './session.utils';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionInfo {
  id: string;
  device: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly ipGeolocation: IpGeolocationService,
  ) {}

  async getActiveSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionInfo[]> {
    const now = new Date();
    const rows = await this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { lastActiveAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      device: row.deviceInfo ?? parseDeviceInfo(row.userAgent),
      ipAddress: row.ipAddress,
      location: row.location,
      lastActiveAt: row.lastActiveAt,
      createdAt: row.createdAt,
      isCurrent: currentSessionId ? row.id === currentSessionId : undefined,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Oturum bulunamadı.');
    }
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: { userId, token: session.token },
      }),
      this.prisma.userSession.delete({ where: { id: session.id } }),
    ]);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
    });
    if (sessions.length === 0) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.userSession.deleteMany({ where: { userId } });
    });
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, id: { not: currentSessionId } },
    });
    await this.prisma.$transaction(async (tx) => {
      for (const s of sessions) {
        await tx.refreshToken.deleteMany({
          where: { userId, token: s.token },
        });
        await tx.userSession.delete({ where: { id: s.id } });
      }
    });
  }

  async rotateRefreshToken(
    userId: string,
    oldRefreshToken: string,
    sessionMeta?: SessionMetaInput,
  ): Promise<TokenPair> {
    const ok = await this.validateRefreshToken(userId, oldRefreshToken);
    if (!ok) {
      throw new UnauthorizedException('Oturum yenilenemedi.');
    }

    await this.touchRefreshSession(userId, oldRefreshToken);
    await this.deleteRefreshTokenByPlain(userId, oldRefreshToken);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { organization: true },
    });
    if (
      !user?.organizationId ||
      !user.organization ||
      (user.organization.suspended && user.role !== UserRole.SUPER_ADMIN)
    ) {
      throw new UnauthorizedException('Oturum yenilenemedi.');
    }

    return this.issueTokenPair(
      user.id,
      user.organizationId,
      user.role,
      sessionMeta,
    );
  }

  async issueTokenPair(
    userId: string,
    orgId: string,
    role: UserRole,
    sessionMeta?: SessionMetaInput,
  ): Promise<TokenPair> {
    const payload = { sub: userId, orgId, role };
    const accessSecret = this.config.getOrThrow<string>('JWT_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExp = (this.config.get<string>('JWT_EXPIRES_IN') ??
      '15m') as NonNullable<JwtSignOptions['expiresIn']>;
    const refreshExp = (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as NonNullable<JwtSignOptions['expiresIn']>;

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExp,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExp,
    });

    const sessionId = await this.storeRefreshToken(
      userId,
      refreshToken,
      sessionMeta,
    );
    return { accessToken, refreshToken, sessionId };
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });
    for (const row of rows) {
      if (await bcrypt.compare(token, row.token)) {
        return true;
      }
    }
    return false;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.deleteRefreshTokenByPlain(userId, refreshToken);
  }

  private refreshTokenExpiresAt(): Date {
    const d = new Date();
    d.setTime(d.getTime() + REFRESH_TOKEN_MS);
    return d;
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    meta?: SessionMetaInput,
  ): Promise<string> {
    const tokenHash = await bcrypt.hash(token, BCRYPT_ROUNDS);
    const expiresAt = this.refreshTokenExpiresAt();
    const deviceInfo = parseDeviceInfo(meta?.userAgent);
    const location = await this.ipGeolocation.resolveLocation(meta?.ipAddress);

    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId,
          token: tokenHash,
          expiresAt,
        },
      });
      const session = await tx.userSession.create({
        data: {
          userId,
          token: tokenHash,
          expiresAt,
          ipAddress: meta?.ipAddress ?? null,
          userAgent: meta?.userAgent ?? null,
          deviceInfo,
          location,
        },
      });
      return session.id;
    });
  }

  private async touchRefreshSession(
    userId: string,
    plain: string,
  ): Promise<void> {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });
    for (const row of rows) {
      if (await bcrypt.compare(plain, row.token)) {
        await this.prisma.userSession.updateMany({
          where: { userId, token: row.token },
          data: { lastActiveAt: new Date() },
        });
        return;
      }
    }
  }

  private async deleteRefreshTokenByPlain(
    userId: string,
    plain: string,
  ): Promise<void> {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId },
    });
    for (const row of rows) {
      if (await bcrypt.compare(plain, row.token)) {
        await this.prisma.$transaction([
          this.prisma.refreshToken.delete({ where: { id: row.id } }),
          this.prisma.userSession.deleteMany({
            where: { userId, token: row.token },
          }),
        ]);
        return;
      }
    }
  }
}
