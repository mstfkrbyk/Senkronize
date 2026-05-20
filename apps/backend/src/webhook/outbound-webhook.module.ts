import { Module } from '@nestjs/common';

import { NotificationModule } from '../notification/notification.module';

import { OutboundWebhookService } from './outbound-webhook.service';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';

@Module({
  imports: [NotificationModule],
  providers: [OutboundWebhookService, WebhookDeliveryProcessor],
  exports: [OutboundWebhookService],
})
export class OutboundWebhookModule {}
