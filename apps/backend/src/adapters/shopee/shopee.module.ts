import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopeeAdapter } from './shopee.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopeeAdapter],
  exports: [ShopeeAdapter],
})
export class ShopeeModule {}
