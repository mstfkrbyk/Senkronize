import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TiktokShopAdapter } from './tiktok-shop.adapter';

@Module({
  imports: [CommonModule],
  providers: [TiktokShopAdapter],
  exports: [TiktokShopAdapter],
})
export class TiktokShopModule {}
