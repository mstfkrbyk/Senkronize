import { Module } from '@nestjs/common';

import { OutboundWebhookService } from './outbound-webhook.service';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';

@Module({
  providers: [OutboundWebhookService, WebhookDeliveryProcessor],
  exports: [OutboundWebhookService],
})
export class OutboundWebhookModule {}
