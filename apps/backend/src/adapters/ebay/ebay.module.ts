import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { EbayAdapter } from './ebay.adapter';

@Module({
  imports: [CommonModule],
  providers: [EbayAdapter],
  exports: [EbayAdapter],
})
export class EbayModule {}
