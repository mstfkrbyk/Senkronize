import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

import { QUEUE_NOTIFICATION } from '../queue/queue.constants';
import type {
  TrendyolWebhookJobData,
  WebhookLogJobData,
} from '../queue/queue.types';

import { WebhookProcessorService } from './webhook-processor.service';
import { WebhookService } from './webhook.service';

@Processor(QUEUE_NOTIFICATION)
export class TrendyolWebhookProcessor {
  private readonly logger = new Logger(TrendyolWebhookProcessor.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly webhookProcessorService: WebhookProcessorService,
  ) {}

  @Process('trendyol-webhook')
  async handleTrendyolWebhook(
    job: Job<TrendyolWebhookJobData>,
  ): Promise<void> {
    this.logger.log(`Trendyol webhook işi alındı: ${job.data.webhookEventId}`);
    await this.webhookService.processTrendyolWebhookJob(job.data.webhookEventId);
  }

  @Process('hepsiburada-webhook')
  async handleHepsiburadaWebhook(
    job: Job<TrendyolWebhookJobData>,
  ): Promise<void> {
    this.logger.log(
      `Hepsiburada webhook işi alındı: ${job.data.webhookEventId}`,
    );
    await this.webhookService.processHepsiburadaWebhookJob(
      job.data.webhookEventId,
    );
  }

  @Process('webhook-log')
  async handleWebhookLog(job: Job<WebhookLogJobData>): Promise<void> {
    this.logger.log(`WebhookLog işi alındı: ${job.data.webhookLogId}`);
    await this.webhookProcessorService.processWebhookLogById(
      job.data.webhookLogId,
    );
  }
}
