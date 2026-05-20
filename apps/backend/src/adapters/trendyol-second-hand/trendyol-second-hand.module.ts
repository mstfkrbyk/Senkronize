import { Module } from '@nestjs/common';

import { TrendyolSecondHandAdapter } from './trendyol-second-hand.adapter';

@Module({
  providers: [TrendyolSecondHandAdapter],
  exports: [TrendyolSecondHandAdapter],
})
export class TrendyolSecondHandModule {}
