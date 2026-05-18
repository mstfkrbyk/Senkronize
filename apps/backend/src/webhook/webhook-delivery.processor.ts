import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';

import { QUEUE_WEBHOOK_DELIVERY } from '../queue/queue.constants';
import type { WebhookDeliveryJobData } from '../queue/queue.types';

import { OutboundWebhookService } from './outbound-webhook.service';

@Injectable()
@Processor(QUEUE_WEBHOOK_DELIVERY)
export class WebhookDeliveryProcessor {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly outboundWebhookService: OutboundWebhookService) {}

  @Process('deliver')
  async handle(job: Job<WebhookDeliveryJobData>): Promise<void> {
    await this.outboundWebhookService.handleDeliveryJob(job);
  }

  @OnQueueFailed()
  async onFailed(job: Job<WebhookDeliveryJobData>, error: Error): Promise<void> {
    const max = job.opts.attempts ?? 1;
    if (job.attemptsMade < max) {
      return;
    }
    this.logger.warn('Giden webhook teslimatı kalıcı olarak başarısız', {
      jobId: job.id != null ? String(job.id) : undefined,
      endpointId: job.data.endpointId,
      event: job.data.event,
      attemptsMade: job.attemptsMade,
      message: error.message,
    });
  }
}
