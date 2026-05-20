import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

import { BuyBoxService } from './buybox.service';
import { CompetitorPriceService } from './competitor-price.service';
import { PriceHistoryService } from './price-history.service';
import { PricingController } from './pricing.controller';
import { PricingEngine } from './pricing.engine';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule, CommonModule],
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
