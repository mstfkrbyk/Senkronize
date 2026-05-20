import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BidorbuyAdapter } from './bidorbuy.adapter';

@Module({
  imports: [CommonModule],
  providers: [BidorbuyAdapter],
  exports: [BidorbuyAdapter],
})
export class BidorbuyModule {}
