import { Module } from '@nestjs/common';

import { ListingModule } from '../listing/listing.module';
import { OrderModule } from '../order/order.module';

import { TrendyolWebhookProcessor } from './trendyol-webhook.processor';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [OrderModule, ListingModule],
  controllers: [WebhookController],
  providers: [WebhookService, TrendyolWebhookProcessor],
})
export class WebhookModule {}
