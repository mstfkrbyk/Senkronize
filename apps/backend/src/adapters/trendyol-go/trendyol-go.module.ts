import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TrendyolGoAdapter } from './trendyol-go.adapter';

@Module({
  imports: [CommonModule],
  providers: [TrendyolGoAdapter],
  exports: [TrendyolGoAdapter],
})
export class TrendyolGoModule {}
