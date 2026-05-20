import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopbackAdapter } from './shopback.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopbackAdapter],
  exports: [ShopbackAdapter],
})
export class ShopbackModule {}
