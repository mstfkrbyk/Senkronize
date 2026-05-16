import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NOTIFICATION } from '../queue/queue.constants';
import type { NotificationJobData } from '../queue/queue.types';

import { NotificationService } from './notification.service';
import { toTemplateData } from './notification.types';
import { renderTemplate } from './templates';

@Processor(QUEUE_NOTIFICATION)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send')
  async handleSend(job: Job<NotificationJobData>): Promise<void> {
    const { channel, template, payload, userId, organizationId } = job.data;
    const templateData = toTemplateData(payload);

    if (channel === 'email') {
      let toEmail: string | undefined;
      if (userId) {
        const user = await this.prisma.user.findFirst({
          where: {
            id: userId,
            organizationId,
            deletedAt: null,
          },
        });
        toEmail = user?.email;
      }
      if (!toEmail && typeof payload.email === 'string') {
        toEmail = payload.email;
      }
      if (!toEmail) {
        this.logger.error(
          'E-posta gönderilemedi: alıcı adresi bulunamadı (userId veya payload.email)',
          { organizationId, template },
        );
        return;
      }

      const { subject, html } = renderTemplate(template, templateData);
      await this.notificationService.sendEmail({
        to: toEmail,
        subject,
        html,
      });
      return;
    }

    if (channel === 'sms') {
      const phone =
        typeof payload.phone === 'string' ? payload.phone : undefined;
      const message =
        typeof payload.message === 'string' ? payload.message : undefined;
      if (!phone || !message) {
        this.logger.error(
          'SMS gönderilemedi: payload.phone veya payload.message eksik',
          { organizationId, template },
        );
        return;
      }
      await this.notificationService.sendSms({ to: phone, message });
      return;
    }

    this.logger.warn(`Desteklenmeyen bildirim kanalı: ${channel}`, {
      organizationId,
      template,
    });
  }
}
