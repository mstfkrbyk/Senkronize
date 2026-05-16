import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import {
  OrgType,
  PlanTier,
  SubStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthenticatedUser } from './auth.types';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta adresi zaten kayıtlı.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const orgName = dto.companyName?.trim() || dto.name;
    const slug = await this.generateUniqueOrgSlug(dto.email);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const now = new Date();

    const newUser = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          slug,
          name: orgName,
          type: OrgType.DIRECT,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          name: dto.name,
          phone: dto.phone?.trim() || null,
          role: UserRole.OWNER,
        },
      });

      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          plan: PlanTier.GELISIM,
          status: SubStatus.TRIAL,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });

      return user;
    });

    void this.notificationService
      .dispatch({
        organizationId: newUser.organizationId,
        channel: 'email',
        template: 'welcome',
        payload: {
          orgName,
          email,
          userEmail: email,
        },
      })
      .catch((error: unknown) => {
        this.logger.error('Hoş geldin bildirimi kuyruğa eklenemedi', {
          organizationId: newUser.organizationId,
          error,
        });
      });

    return this.generateTokens(
      newUser.id,
      newUser.organizationId,
      UserRole.OWNER,
    );
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      include: { organization: true },
    });

    if (
      !user ||
      user.organization.deletedAt != null ||
      !(await this.comparePasswords(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.organizationId, user.role);
  }

  async refresh(
    userId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const ok = await this.validateRefreshToken(userId, refreshToken);
    if (!ok) {
      throw new UnauthorizedException('Oturum yenilenemedi.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException('Oturum yenilenemedi.');
    }

    await this.deleteRefreshTokenByPlain(userId, refreshToken);

    return this.generateTokens(user.id, user.organizationId, user.role);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.deleteRefreshTokenByPlain(userId, refreshToken);
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

  async getCurrentOrganization(user: AuthenticatedUser) {
    return this.prisma.organization.findFirstOrThrow({
      where: { id: user.currentOrgId, deletedAt: null },
    });
  }

  private async generateUniqueOrgSlug(email: string): Promise<string> {
    const domain = email.split('@')[1]?.toLowerCase() ?? 'org';
    const base =
      domain
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'org';

    for (let i = 0; i < 8; i++) {
      const suffix = randomBytes(3).toString('hex');
      const slug = `${base}-${suffix}`;
      const clash = await this.prisma.organization.findUnique({
        where: { slug },
      });
      if (!clash) {
        return slug;
      }
    }
    return `${base}-${randomBytes(8).toString('hex')}`;
  }

  private async generateTokens(
    userId: string,
    orgId: string,
    role: UserRole,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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

    await this.storeRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  private async comparePasswords(
    plain: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private refreshTokenExpiresAt(): Date {
    const d = new Date();
    d.setTime(d.getTime() + REFRESH_TOKEN_MS);
    return d;
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await bcrypt.hash(token, BCRYPT_ROUNDS);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: tokenHash,
        expiresAt: this.refreshTokenExpiresAt(),
      },
    });
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
        await this.prisma.refreshToken.delete({ where: { id: row.id } });
        return;
      }
    }
  }
}
