import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { PartnerService } from '../partner/partner.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { AnomalyDetectionService } from '../security/anomaly-detection.service';
import { SecurityNotificationService } from '../security/security-notification.service';
import {
  ChangePasswordDto,
  LoginDto,
  RecommendPlanDto,
  RegisterDto,
  UpdateProfileDto,
} from './auth.dto';
import { AuthenticatedUser } from './auth.types';
import { PasswordPolicyService } from './password-policy.service';
import { SessionService, type TokenPair } from './session.service';
import { parseDeviceInfo } from './session.utils';
import { TwoFactorService } from './two-factor.service';

const BCRYPT_ROUNDS = 10;

export type IssueTokenResult = TokenPair;

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
    private readonly partnerService: PartnerService,
    private readonly twoFactorService: TwoFactorService,
    private readonly cache: CacheService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly sessionService: SessionService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly securityNotification: SecurityNotificationService,
  ) {}

  async register(dto: RegisterDto): Promise<IssueTokenResult> {
    const passwordCheck = this.passwordPolicy.validatePassword(dto.password);
    if (!passwordCheck.valid) {
      throw new BadRequestException(passwordCheck.errors[0]);
    }

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

    let partnerOnboardingToken: string | null = null;
    let partnerOrgIdFromInvite: string | null = null;
    const rawInviteToken = dto.inviteToken?.trim();
    if (rawInviteToken) {
      const invite = await this.partnerService.validateInviteToken(rawInviteToken);
      if (invite.email.toLowerCase() !== email) {
        throw new BadRequestException(
          'Davet e-postası ile kayıt e-postası eşleşmiyor.',
        );
      }
      partnerOnboardingToken = rawInviteToken;
      partnerOrgIdFromInvite = invite.partnerOrgId;
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
          referralCode:
            (partnerOrgIdFromInvite ?? dto.referralCode?.trim()) || null,
        },
      });

      if (partnerOnboardingToken) {
        await this.partnerService.completeClientOnboarding(
          partnerOnboardingToken,
          organization.id,
          tx,
        );
      }

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
        organizationId: newUser.organizationId!,
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
          organizationId: newUser.organizationId!,
          error,
        });
      });

    void this.emailService.sendWelcome(email, dto.name).catch((error: unknown) => {
      this.logger.error('Hoş geldin e-postası gönderilemedi', {
        organizationId: newUser.organizationId!,
        error,
      });
    });

    if (newUser.phone) {
      void this.smsService.sendWelcome(newUser.phone, dto.name).catch((error: unknown) => {
        this.logger.error('Hoş geldin SMS gönderilemedi', {
          organizationId: newUser.organizationId!,
          error,
        });
      });
    }

    await this.handleSuccessfulLogin(email);

    return this.sessionService.issueTokenPair(
      newUser.id,
      newUser.organizationId!,
      UserRole.OWNER,
      undefined,
    );
  }

  async handleSuccessfulLogin(email: string): Promise<void> {
    await this.cache.del(CacheService.key('login_fails', email.toLowerCase()));
  }

  private async handleFailedLogin(email: string): Promise<void> {
    const normalized = email.toLowerCase();
    const key = CacheService.key('login_fails', normalized);
    const n = await this.cache.incrWithExpire(key, 900);
    if (n === null || n !== 5) {
      return;
    }
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
    });
    if (!user) {
      return;
    }
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + 15);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil },
    });
    await this.emailService.sendAccountLockNotification(user.email);
    void this.securityNotification.notifySuspiciousLogin(
      user,
      'Çok sayıda başarısız giriş denemesi nedeniyle hesabınız geçici olarak kilitlendi.',
    );
  }

  async issueTokenPair(
    userId: string,
    organizationId: string,
    role: UserRole,
    sessionMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<IssueTokenResult> {
    return this.sessionService.issueTokenPair(
      userId,
      organizationId,
      role,
      sessionMeta,
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
    sessionMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<
    | IssueTokenResult
    | { requiresTwoFactor: true; tempToken: string }
  > {
    const emailLower = dto.email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: emailLower, deletedAt: null },
      include: { organization: true },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Hesabınız geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.',
      );
    }

    if (
      !user ||
      !user.organizationId ||
      !user.organization ||
      user.organization.deletedAt != null
    ) {
      await this.handleFailedLogin(emailLower);
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    const passwordOk = await this.comparePasswords(
      dto.password,
      user.passwordHash,
    );
    if (!passwordOk) {
      await this.handleFailedLogin(emailLower);
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

    if (user.twoFactorEnabled) {
      await this.handleSuccessfulLogin(user.email);
      const tempToken = await this.jwtService.signAsync(
        { sub: user.id, type: 'two-factor-pending' },
        {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
          expiresIn: '5m',
        },
      );
      return { requiresTwoFactor: true, tempToken };
    }

    await this.handleSuccessfulLogin(user.email);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lockedUntil: null },
    });

    await this.notifyLoginIfNewDevice(user, sessionMeta);

    return this.sessionService.issueTokenPair(
      user.id,
      user.organizationId,
      user.role,
      sessionMeta,
    );
  }

  async completeTwoFactorLogin(
    tempToken: string,
    tfaCode: string,
    sessionMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<IssueTokenResult> {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; type?: string }>(
        tempToken,
        { secret: this.config.getOrThrow<string>('JWT_SECRET') },
      );
    } catch {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş oturum doğrulaması.',
      );
    }
    if (payload.type !== 'two-factor-pending') {
      throw new UnauthorizedException('Geçersiz oturum doğrulaması.');
    }

    const valid = await this.twoFactorService.verifyTokenForLogin(
      payload.sub,
      tfaCode,
    );
    if (!valid) {
      throw new UnauthorizedException('Geçersiz 2FA kodu');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }
    if (
      !user.organizationId ||
      !user.organization ||
      user.organization.deletedAt != null ||
      (user.organization.suspended && user.role !== UserRole.SUPER_ADMIN)
    ) {
      throw new UnauthorizedException('Oturum açılamadı.');
    }

    await this.handleSuccessfulLogin(user.email);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lockedUntil: null },
    });

    await this.notifyLoginIfNewDevice(user, sessionMeta);

    return this.sessionService.issueTokenPair(
      user.id,
      user.organizationId,
      user.role,
      sessionMeta,
    );
  }

  async refresh(
    userId: string,
    refreshToken: string,
    sessionMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<IssueTokenResult> {
    return this.sessionService.rotateRefreshToken(
      userId,
      refreshToken,
      sessionMeta,
    );
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.sessionService.logout(userId, refreshToken);
  }

  async changePassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const passwordCheck = this.passwordPolicy.validatePassword(dto.newPassword);
    if (!passwordCheck.valid) {
      throw new BadRequestException(passwordCheck.errors[0]);
    }

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
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'auth.password_changed',
        resourceType: 'User',
        resourceId: user.id,
        metadata: {},
      },
    });

    void this.securityNotification.notifyPasswordChanged(user);
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

  private async notifyLoginIfNewDevice(
    user: {
      id: string;
      email: string;
      organizationId: string | null;
    },
    sessionMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const ip = sessionMeta?.ipAddress;
    void this.anomalyDetectionService.checkNewIpLogin(user.id, ip);

    if (!ip) {
      return;
    }
    const key = CacheService.key('security', 'known_login_ip', user.id);
    const known = await this.cache.sismember(key, ip);
    if (known === true) {
      return;
    }
    if (known === null) {
      return;
    }

    const fullUser = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
    });
    if (!fullUser) {
      return;
    }

    const deviceInfo = parseDeviceInfo(sessionMeta?.userAgent);
    void this.securityNotification.notifyNewDeviceLogin(fullUser, {
      ipAddress: ip,
      userAgent: sessionMeta?.userAgent,
      deviceInfo,
      location: null,
    });
    await this.cache.sadd(key, ip);
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
      (subscription.status === SubStatus.CANCELLED ||
        subscription.status === SubStatus.CANCELING) &&
      now >
        (subscription.subscriptionEndsAt ?? subscription.currentPeriodEnd)
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

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  private async comparePasswords(
    plain: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
