import { Module } from '@nestjs/common';

import { TrendyolPremiumAdapter } from './trendyol-premium.adapter';

@Module({
  providers: [TrendyolPremiumAdapter],
  exports: [TrendyolPremiumAdapter],
})
export class TrendyolPremiumModule {}
