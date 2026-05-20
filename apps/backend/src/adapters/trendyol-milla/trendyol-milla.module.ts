import { Module } from '@nestjs/common';

import { TrendyolMillaAdapter } from './trendyol-milla.adapter';

@Module({
  providers: [TrendyolMillaAdapter],
  exports: [TrendyolMillaAdapter],
})
export class TrendyolMillaModule {}
