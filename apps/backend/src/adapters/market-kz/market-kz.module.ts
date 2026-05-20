import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MarketKzAdapter } from './market-kz.adapter';

@Module({
  imports: [CommonModule],
  providers: [MarketKzAdapter],
  exports: [MarketKzAdapter],
})
export class MarketKzModule {}
