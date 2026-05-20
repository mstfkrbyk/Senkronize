import { Module } from '@nestjs/common';

import { ListingModule } from '../listing/listing.module';
import { OrderModule } from '../order/order.module';

import { OutboundWebhookModule } from './outbound-webhook.module';
import { TrendyolWebhookProcessor } from './trendyol-webhook.processor';
import { WebhookConnectionResolverService } from './webhook-connection-resolver.service';
import { PlatformWebhookController } from './platform-webhook.controller';
import { PlatformWebhookService } from './platform-webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookProcessorService } from './webhook-processor.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookService } from './webhook.service';

@Module({
  imports: [OrderModule, ListingModule, OutboundWebhookModule],
  controllers: [WebhookController, PlatformWebhookController],
  providers: [
    WebhookService,
    WebhookSignatureService,
    WebhookConnectionResolverService,
    WebhookProcessorService,
    TrendyolWebhookProcessor,
    PlatformWebhookService,
  ],
})
export class WebhookModule {}
