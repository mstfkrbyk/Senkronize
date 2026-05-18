import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubStatus, UserRole } from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class TrialExpiryTask {
  private readonly logger = new Logger(TrialExpiryTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredTrials(): Promise<void> {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.TRIAL,
        trialEndsAt: { lt: new Date() },
      },
    });

    for (const sub of expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubStatus.EXPIRED },
      });
      this.logger.log(`Deneme süresi doldu: org=${sub.organizationId}`);
    }
  }

  /** Deneme bitimine 3 gün kala günlük hatırlatma (tekrar gönderimi audit ile engeller). */
  @Cron('0 9 * * *')
  async notifyTrialsEndingSoon(): Promise<void> {
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.TRIAL,
        trialEndsAt: { gt: new Date() },
      },
    });

    for (const sub of subs) {
      if (!sub.trialEndsAt) {
        continue;
      }
      const daysLeft = Math.ceil(
        (sub.trialEndsAt.getTime() - Date.now()) / MS_PER_DAY,
      );
      if (daysLeft !== 3) {
        continue;
      }

      const alreadySent = await this.prisma.auditLog.findFirst({
        where: {
          action: 'email.trial_expiring_3d',
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
        await this.emailService.sendTrialExpiring(
          owner.email,
          owner.name ?? 'Merhaba',
          3,
        );
        await this.prisma.auditLog.create({
          data: {
            actorUserId: owner.id,
            actorOrgId: sub.organizationId,
            impersonatedOrgId: null,
            action: 'email.trial_expiring_3d',
            resourceType: 'Subscription',
            resourceId: sub.id,
            metadata: {},
          },
        });
      } catch (error: unknown) {
        this.logger.error('Deneme bitiş hatırlatma e-postası başarısız', {
          organizationId: sub.organizationId,
          error,
        });
      }
    }
  }
}
