import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type User, type UserInvite, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 10;
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export interface UserInvitePreview {
  organizationName: string;
  email: string;
  expiresAt: string;
}

@Injectable()
export class UserInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  private buildAcceptInviteUrl(plainToken: string): string {
    const base = this.panelBaseUrl().replace(/\/$/, '');
    return `${base}/accept-invite?token=${encodeURIComponent(plainToken)}`;
  }

  async getInvitePreview(token: string): Promise<UserInvitePreview> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new BadRequestException('Davet jetonu gerekli.');
    }
    const invite = await this.prisma.userInvite.findFirst({
      where: { token: trimmed, acceptedAt: null },
      include: { organization: true },
    });
    if (!invite || invite.expiresAt <= new Date()) {
      throw new NotFoundException('Davet bulunamadı veya süresi dolmuş.');
    }
    return {
      organizationName: invite.organization.name,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async inviteUser(
    orgId: string,
    invitedByUserId: string,
    emailRaw: string,
    role: UserRole,
  ): Promise<UserInvite> {
    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('E-posta gerekli.');
    }

    if (role === UserRole.OWNER || role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Bu rol ile davet oluşturulamaz.');
    }

    const inviter = await this.prisma.user.findFirst({
      where: { id: invitedByUserId, organizationId: orgId, deletedAt: null },
    });
    if (!inviter) {
      throw new ForbiddenException('Davet gönderemezsiniz.');
    }

    const existingMember = await this.prisma.user.findFirst({
      where: { organizationId: orgId, email, deletedAt: null },
    });
    if (existingMember) {
      throw new ConflictException('Bu e-posta zaten organizasyon üyesi.');
    }

    const pending = await this.prisma.userInvite.findFirst({
      where: { organizationId: orgId, email, acceptedAt: null },
    });
    if (pending && pending.expiresAt > new Date()) {
      throw new ConflictException('Bu adres için bekleyen bir davet zaten var.');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });
    if (subscription?.userLimit != null) {
      const memberCount = await this.prisma.user.count({
        where: { organizationId: orgId, deletedAt: null },
      });
      if (memberCount >= subscription.userLimit) {
        throw new ConflictException(
          'Paketinizin kullanıcı limitine ulaşıldı. Limiti artırın veya paketi yükseltin.',
        );
      }
    }

    const plainToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const invite = await this.prisma.userInvite.create({
      data: {
        organizationId: orgId,
        email,
        role,
        invitedBy: invitedByUserId,
        token: plainToken,
        expiresAt,
      },
    });

    const inviteUrl = this.buildAcceptInviteUrl(plainToken);
    void this.emailService
      .sendOrganizationUserInvite(email, {
        organizationName: org.name,
        inviteUrl,
      })
      .catch(() => undefined);

    return invite;
  }

  async acceptInvite(
    token: string,
    password: string,
    name: string,
    sessionMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new BadRequestException('Davet jetonu gerekli.');
    }

    const invite = await this.prisma.userInvite.findFirst({
      where: { token: trimmed, acceptedAt: null },
      include: { organization: true },
    });
    if (!invite || invite.expiresAt <= new Date()) {
      throw new NotFoundException('Davet bulunamadı veya süresi dolmuş.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const displayName = name.trim() || invite.email.split('@')[0] || 'Kullanıcı';

    const resultUser = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { email: invite.email, deletedAt: null },
      });

      let user: User;

      if (existing) {
        if (
          existing.organizationId != null &&
          existing.organizationId !== invite.organizationId
        ) {
          throw new ConflictException(
            'Bu e-posta başka bir organizasyona bağlı. Önce mevcut üyelikten çıkın.',
          );
        }
        if (existing.organizationId === invite.organizationId) {
          throw new ConflictException('Zaten bu organizasyonun üyesisiniz.');
        }

        user = await tx.user.update({
          where: { id: existing.id },
          data: {
            organizationId: invite.organizationId,
            role: invite.role,
            passwordHash,
            name: displayName,
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            organizationId: invite.organizationId,
            email: invite.email,
            passwordHash,
            name: displayName,
            role: invite.role,
          },
        });
      }

      await tx.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.notificationPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, organizationId: invite.organizationId },
        update: { organizationId: invite.organizationId },
      });

      return user;
    });

    return this.authService.issueTokenPair(
      resultUser.id,
      invite.organizationId,
      resultUser.role,
      sessionMeta,
    );
  }

  async cancelInvite(orgId: string, inviteId: string): Promise<void> {
    const invite = await this.prisma.userInvite.findFirst({
      where: { id: inviteId, organizationId: orgId, acceptedAt: null },
    });
    if (!invite) {
      throw new NotFoundException('Davet bulunamadı.');
    }
    await this.prisma.userInvite.delete({ where: { id: invite.id } });
  }

  async listInvites(orgId: string): Promise<UserInvite[]> {
    return this.prisma.userInvite.findMany({
      where: { organizationId: orgId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resendInvite(orgId: string, inviteId: string): Promise<void> {
    const invite = await this.prisma.userInvite.findFirst({
      where: { id: inviteId, organizationId: orgId, acceptedAt: null },
      include: { organization: true },
    });
    if (!invite) {
      throw new NotFoundException('Davet bulunamadı.');
    }

    const plainToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await this.prisma.userInvite.update({
      where: { id: invite.id },
      data: { token: plainToken, expiresAt },
    });

    const inviteUrl = this.buildAcceptInviteUrl(plainToken);
    void this.emailService
      .sendOrganizationUserInvite(invite.email, {
        organizationName: invite.organization.name,
        inviteUrl,
      })
      .catch(() => undefined);
  }
}
