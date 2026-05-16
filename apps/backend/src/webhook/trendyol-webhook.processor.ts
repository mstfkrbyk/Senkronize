import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

import { QUEUE_NOTIFICATION } from '../queue/queue.constants';
import type { TrendyolWebhookJobData } from '../queue/queue.types';

import { WebhookService } from './webhook.service';

@Processor(QUEUE_NOTIFICATION)
export class TrendyolWebhookProcessor {
  private readonly logger = new Logger(TrendyolWebhookProcessor.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Process('trendyol-webhook')
  async handleTrendyolWebhook(
    job: Job<TrendyolWebhookJobData>,
  ): Promise<void> {
    this.logger.log(`Trendyol webhook işi alındı: ${job.data.webhookEventId}`);
    await this.webhookService.processTrendyolWebhookJob(job.data.webhookEventId);
  }
}
