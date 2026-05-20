import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { QUEUE_LISTING_SYNC } from '../queue/queue.constants';

import { BuyBoxService } from './buybox.service';
import { CompetitorPriceService } from './competitor-price.service';
import { PriceHistoryService } from './price-history.service';
import { PricingController } from './pricing.controller';
import { PricingEngine } from './pricing.engine';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    BullModule.registerQueue({ name: QUEUE_LISTING_SYNC }),
  ],
  controllers: [PricingController],
  providers: [
    PricingService,
    PricingEngine,
    BuyBoxService,
    CompetitorPriceService,
    PriceHistoryService,
  ],
  exports: [
    PricingService,
    PricingEngine,
    BuyBoxService,
    CompetitorPriceService,
    PriceHistoryService,
  ],
})
export class PricingModule {}
