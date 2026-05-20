import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BestbuyAdapter } from './bestbuy.adapter';

@Module({
  imports: [CommonModule],
  providers: [BestbuyAdapter],
  exports: [BestbuyAdapter],
})
export class BestbuyModule {}
