import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopeeThAdapter } from './shopee-th.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopeeThAdapter],
  exports: [ShopeeThAdapter],
})
export class ShopeeThModule {}
