import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { SubStatus, UserRole } from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class SubscriptionRenewalTask {
  private readonly logger = new Logger(SubscriptionRenewalTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  /** Aktif abonelik bitimine 7 gün kala günlük hatırlatma */
  @Cron('0 9 * * *')
  async notifySubscriptionsExpiringSoon(): Promise<void> {
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.ACTIVE,
        currentPeriodEnd: { gt: new Date() },
      },
    });

    for (const sub of subs) {
      if (!sub.currentPeriodEnd) {
        continue;
      }
      const daysLeft = Math.ceil(
        (sub.currentPeriodEnd.getTime() - Date.now()) / MS_PER_DAY,
      );
      if (daysLeft !== 7) {
        continue;
      }

      const alreadySent = await this.prisma.auditLog.findFirst({
        where: {
          action: 'email.subscription_expiring_7d',
          resourceType: 'Subscription',
          resourceId: sub.id,
        },
      });
      if (alreadySent) {
        continue;
      }

      const owner = await this.prisma.user.findFirst({
        where: {
          organizationId: sub.organizationId,
          role: UserRole.OWNER,
          deletedAt: null,
        },
      });
      if (!owner?.email) {
        continue;
      }

      try {
        await this.emailService.sendSubscriptionExpiring(
          owner.email,
          daysLeft,
          `${this.panelBaseUrl()}/settings/subscription`,
        );
        await this.prisma.auditLog.create({
          data: {
            actorUserId: owner.id,
            actorOrgId: sub.organizationId,
            impersonatedOrgId: null,
            action: 'email.subscription_expiring_7d',
            resourceType: 'Subscription',
            resourceId: sub.id,
            metadata: { daysLeft },
          },
        });
      } catch (error: unknown) {
        this.logger.error('Abonelik yenileme hatırlatma e-postası başarısız', {
          organizationId: sub.organizationId,
          error,
        });
      }
    }
  }
}
