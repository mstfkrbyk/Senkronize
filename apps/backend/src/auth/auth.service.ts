import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
  type Subscription,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../notifications/email/email.service';
import { SmsService } from '../notifications/sms/sms.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangePasswordDto,
  LoginDto,
  RecommendPlanDto,
  RegisterDto,
  UpdateProfileDto,
} from './auth.dto';
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
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
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

    const normalizedTax = dto.taxNumber.trim();
    const existingTaxOrg = await this.prisma.organization.findFirst({
      where: { taxNumber: normalizedTax, deletedAt: null },
    });
    if (existingTaxOrg) {
      throw new ConflictException('Bu vergi numarasıyla zaten kayıt mevcut');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const orgName = dto.companyName.trim();
    const slug = await this.generateUniqueOrgSlug(dto.email);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const now = new Date();
    const selectedPlan = dto.plan ?? PlanTier.GELISIM;

    const newUser = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          slug,
          name: orgName,
          type: dto.orgType ?? OrgType.DIRECT,
          taxNumber: normalizedTax,
          taxOffice: dto.taxOffice.trim(),
          address: dto.address.trim(),
          city: dto.city.trim(),
          website: dto.website?.trim() || null,
          referralCode: dto.referralCode?.trim() || null,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          name: dto.name,
          phone: dto.phone.trim(),
          role: UserRole.OWNER,
        },
      });

      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          plan: selectedPlan,
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

    void this.emailService.sendWelcome(email, dto.name).catch((error: unknown) => {
      this.logger.error('Hoş geldin e-postası gönderilemedi', {
        organizationId: newUser.organizationId,
        error,
      });
    });

    if (newUser.phone) {
      void this.smsService.sendWelcome(newUser.phone, dto.name).catch((error: unknown) => {
        this.logger.error('Hoş geldin SMS gönderilemedi', {
          organizationId: newUser.organizationId,
          error,
        });
      });
    }

    return this.generateTokens(
      newUser.id,
      newUser.organizationId,
      UserRole.OWNER,
    );
  }

  recommendPlan(dto: RecommendPlanDto): {
    recommendedPlan: PlanTier;
    reason: string;
  } {
    const totalChannels = dto.marketplaceCount + dto.ecommerceCount;
    const { erpCount } = dto;

    if (totalChannels > 8 || erpCount > 1) {
      return {
        recommendedPlan: PlanTier.KURUMSAL,
        reason:
          'Çok sayıda satış kanalı veya birden fazla ERP ihtiyacı Kurumsal paketin sunduğu kapasite ve destek ile uyumludur.',
      };
    }
    if (erpCount > 0) {
      return {
        recommendedPlan: PlanTier.PRO,
        reason:
          'ERP kullanımı sipariş ve stok akışında daha derin entegrasyon gerektirir; Pro paket bu senaryo için önerilir.',
      };
    }
    if (totalChannels <= 2 && erpCount === 0) {
      return {
        recommendedPlan: PlanTier.BASLANGIC,
        reason:
          'Az sayıda satış kanalı ve ERP kullanmıyorsanız Başlangıç paketi işletmeniz için yeterlidir.',
      };
    }
    if (totalChannels <= 4) {
      return {
        recommendedPlan: PlanTier.GELISIM,
        reason:
          'Birden fazla pazaryeri veya e-ticaret kanalı için Gelişim paketi dengeli özellik ve limitler sunar.',
      };
    }
    if (totalChannels <= 8) {
      return {
        recommendedPlan: PlanTier.PRO,
        reason:
          'Daha fazla kanal ve iş hacmi için Pro paketin limitleri ve gelişmiş özellikleri daha uygundur.',
      };
    }
    return {
      recommendedPlan: PlanTier.KURUMSAL,
      reason:
        'Yüksek kanal sayısı veya özel ihtiyaçlar için Kurumsal paket ile sınırları genişletebilirsiniz.',
    };
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

    if (
      user.organization.suspended &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new UnauthorizedException(
        'Hesabınız askıya alındı. Destek ile iletişime geçin.',
      );
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
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Oturum yenilenemedi.');
    }

    if (
      user.organization.suspended &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
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

  async changePassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const isValid = await this.comparePasswords(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'auth.password_changed',
        resourceType: 'User',
        resourceId: user.id,
        metadata: {},
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<void> {
    if (dto.name === undefined) {
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
    });
  }

  async getCurrentOrganization(user: AuthenticatedUser) {
    const org = await this.prisma.organization.findFirstOrThrow({
      where: { id: user.currentOrgId, deletedAt: null },
      include: { subscription: true },
    });
    const { subscription, ...rest } = org;
    const plan = this.resolveUiPlanTier(subscription);
    return {
      id: rest.id,
      slug: rest.slug,
      name: rest.name,
      type: rest.type,
      logoUrl: rest.logoUrl,
      createdAt: rest.createdAt,
      onboardingCompleted: rest.onboardingCompleted,
      plan,
    };
  }

  private resolveUiPlanTier(subscription: Subscription | null): PlanTier {
    const now = new Date();
    if (!subscription) {
      return PlanTier.BASLANGIC;
    }
    if (
      subscription.status === SubStatus.EXPIRED ||
      subscription.status === SubStatus.PAUSED
    ) {
      return PlanTier.BASLANGIC;
    }
    if (
      subscription.status === SubStatus.CANCELLED &&
      now > subscription.currentPeriodEnd
    ) {
      return PlanTier.BASLANGIC;
    }
    if (subscription.status === SubStatus.TRIAL) {
      if (subscription.trialEndsAt && now > subscription.trialEndsAt) {
        return PlanTier.BASLANGIC;
      }
      return PlanTier.BASLANGIC;
    }
    return subscription.plan;
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
