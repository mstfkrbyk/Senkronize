import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ToyzzShopAdapter } from './toyzz-shop.adapter';

@Module({
  imports: [CommonModule],
  providers: [ToyzzShopAdapter],
  exports: [ToyzzShopAdapter],
})
export class ToyzzShopModule {}
