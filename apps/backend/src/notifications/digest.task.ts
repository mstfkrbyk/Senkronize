import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email/email.service';
import { NotificationService } from './notification.service';

interface DigestUserRow {
  id: string;
  email: string;
  prefs: {
    digestFrequency: string;
    digestHour: number;
  };
}

@Injectable()
export class NotificationDigestTask {
  private readonly logger = new Logger(NotificationDigestTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 * * * *')
  async sendDigests(): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const users = await this.getUsersForDigest(hour, dayOfWeek);
    for (const user of users) {
      try {
        const queued = await this.notificationService.getQueuedNotifications(
          user.id,
        );
        if (queued.length === 0) {
          continue;
        }

        await this.emailService.sendDigestEmail(user.email, {
          period: user.prefs.digestFrequency,
          notifications: queued.map((n) => ({
            eventType: n.eventType,
            title: n.title,
            message: n.message,
            link: n.link,
            createdAt: n.createdAt,
          })),
        });

        await this.notificationService.clearQueue(user.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Özet e-postası gönderilemedi: user=${user.id}`, {
          message,
        });
      }
    }
  }

  private async getUsersForDigest(
    hour: number,
    dayOfWeek: number,
  ): Promise<DigestUserRow[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: {
        emailEnabled: true,
        digestFrequency: { in: ['daily', 'weekly'] },
        digestHour: hour,
      },
      select: {
        digestFrequency: true,
        digestHour: true,
        user: {
          select: { id: true, email: true, deletedAt: true },
        },
      },
    });

    return rows
      .filter((r) => {
        if (r.user.deletedAt !== null) {
          return false;
        }
        if (r.digestFrequency === 'weekly') {
          return dayOfWeek === 1;
        }
        return true;
      })
      .map((r) => ({
        id: r.user.id,
        email: r.user.email,
        prefs: {
          digestFrequency: r.digestFrequency,
          digestHour: r.digestHour,
        },
      }));
  }
}
