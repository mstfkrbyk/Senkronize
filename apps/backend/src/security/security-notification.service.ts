import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import { NotificationType } from '@prisma/client';

import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

export interface LoginInfo {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string | null;
  location?: string | null;
}

@Injectable()
export class SecurityNotificationService {
  private readonly logger = new Logger(SecurityNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async notifyNewDeviceLogin(user: User, loginInfo: LoginInfo): Promise<void> {
    const device = loginInfo.deviceInfo ?? 'Bilinmeyen cihaz';
    const ip = loginInfo.ipAddress ?? '—';
    const location = loginInfo.location ?? 'Bilinmiyor';

    void this.emailService
      .sendNewDeviceLoginAlert(user.email, {
        ip,
        device,
        location,
      })
      .catch((error: unknown) => {
        this.logger.error('Yeni cihaz e-postası gönderilemedi', {
          userId: user.id,
          error,
        });
      });

    if (!user.organizationId) {
      return;
    }

    await this.createInApp(
      user.organizationId,
      user.id,
      'Yeni cihazdan giriş',
      `${device} üzerinden giriş yapıldı (IP: ${ip}, Konum: ${location}).`,
      '/settings?tab=security',
    );
  }

  async notifyPasswordChanged(user: User): Promise<void> {
    void this.emailService
      .sendPasswordChangedAlert(user.email)
      .catch((error: unknown) => {
        this.logger.error('Şifre değişikliği e-postası gönderilemedi', {
          userId: user.id,
          error,
        });
      });

    if (!user.organizationId) {
      return;
    }

    await this.createInApp(
      user.organizationId,
      user.id,
      'Şifre değiştirildi',
      'Hesap şifreniz az önce güncellendi. Siz değilseniz hemen destek ile iletişime geçin.',
      '/settings?tab=security',
    );
  }

  async notify2FAStatusChange(user: User, enabled: boolean): Promise<void> {
    void this.emailService
      .sendTwoFactorStatusAlert(user.email, enabled)
      .catch((error: unknown) => {
        this.logger.error('2FA durum e-postası gönderilemedi', {
          userId: user.id,
          error,
        });
      });

    if (!user.organizationId) {
      return;
    }

    const title = enabled ? '2FA etkinleştirildi' : '2FA devre dışı bırakıldı';
    const message = enabled
      ? 'İki adımlı doğrulama hesabınızda etkinleştirildi.'
      : 'İki adımlı doğrulama hesabınızda kapatıldı. Siz yapmadıysanız şifrenizi değiştirin.';

    await this.createInApp(
      user.organizationId,
      user.id,
      title,
      message,
      '/settings?tab=security',
    );
  }

  async notifySuspiciousLogin(user: User, reason: string): Promise<void> {
    void this.emailService
      .sendSuspiciousLoginAlert(user.email, reason)
      .catch((error: unknown) => {
        this.logger.error('Şüpheli giriş e-postası gönderilemedi', {
          userId: user.id,
          error,
        });
      });

    if (!user.organizationId) {
      return;
    }

    await this.createInApp(
      user.organizationId,
      user.id,
      'Şüpheli giriş denemesi',
      reason,
      '/settings?tab=security',
    );
  }

  private async createInApp(
    organizationId: string,
    userId: string,
    title: string,
    message: string,
    link: string,
  ): Promise<void> {
    try {
      await this.inAppNotificationService.create({
        organizationId,
        userId,
        type: NotificationType.SYSTEM,
        title,
        message,
        link,
        metadata: { category: 'security' },
      });
    } catch (error: unknown) {
      this.logger.error('Güvenlik in-app bildirimi oluşturulamadı', {
        organizationId,
        userId,
        error,
      });
    }
  }
}
