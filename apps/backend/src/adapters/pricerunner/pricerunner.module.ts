import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PricerunnerAdapter } from './pricerunner.adapter';

@Module({
  imports: [CommonModule],
  providers: [PricerunnerAdapter],
  exports: [PricerunnerAdapter],
})
export class PricerunnerModule {}
