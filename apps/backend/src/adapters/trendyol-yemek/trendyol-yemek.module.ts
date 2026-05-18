import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TrendyolYemekAdapter } from './trendyol-yemek.adapter';

@Module({
  imports: [CommonModule],
  providers: [TrendyolYemekAdapter],
  exports: [TrendyolYemekAdapter],
})
export class TrendyolYemekModule {}
