import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PricespyAdapter } from './pricespy.adapter';

@Module({
  imports: [CommonModule],
  providers: [PricespyAdapter],
  exports: [PricespyAdapter],
})
export class PricespyModule {}
