import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import { Resend } from 'resend';

import { QUEUE_NOTIFICATION } from '../queue/queue.constants';
import type { NotificationJobData } from '../queue/queue.types';

import type { EmailPayload, SmsPayload } from './notification.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue<NotificationJobData>,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY tanımlı değil; e-posta mock modunda çalışılacak.',
      );
    }
    this.fromEmail =
      this.config.get<string>('RESEND_FROM_EMAIL') ?? 'noreply@senkronize.com';
  }

  async dispatch(data: NotificationJobData): Promise<void> {
    await this.notificationQueue.add('send', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
    this.logger.log(
      `Bildirim kuyruğa eklendi: ${data.channel}/${data.template} (org=${data.organizationId})`,
    );
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Mock e-posta: gönderilmedi', {
        to: payload.to,
        subject: payload.subject,
      });
      return;
    }

    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (result.error) {
      this.logger.error('Resend e-posta hatası', {
        message: result.error.message,
        to: payload.to,
      });
      throw new Error(result.error.message);
    }
  }

  async sendSms(payload: SmsPayload): Promise<void> {
    const usercode = this.config.get<string>('NETGSM_USERCODE')?.trim();
    const password = this.config.get<string>('NETGSM_PASSWORD')?.trim();
    if (!usercode || !password) {
      this.logger.warn(
        'Netgsm yapılandırması eksik; SMS mock modunda (gönderilmedi).',
      );
      return;
    }

    const params = new URLSearchParams({
      usercode,
      password,
      gsmno: payload.to,
      message: payload.message,
      msgheader:
        this.config.get<string>('NETGSM_HEADER')?.trim() ?? 'SENKRONIZE',
    });

    const response = await fetch(
      `https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`,
    );
    const text = await response.text();
    if (!text.startsWith('00') && !text.startsWith('01')) {
      this.logger.error('SMS gönderim hatası', { code: text, to: payload.to });
    }
  }
}
