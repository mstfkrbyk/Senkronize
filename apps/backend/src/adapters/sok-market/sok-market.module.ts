import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SokMarketAdapter } from './sok-market.adapter';

@Module({
  imports: [CommonModule],
  providers: [SokMarketAdapter],
  exports: [SokMarketAdapter],
})
export class SokMarketModule {}
