import { Module } from '@nestjs/common';

import { TrendyolIntAdapter } from './trendyol-int.adapter';

@Module({
  providers: [TrendyolIntAdapter],
  exports: [TrendyolIntAdapter],
})
export class TrendyolIntModule {}
