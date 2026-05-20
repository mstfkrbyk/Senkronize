import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { InstagramShopAdapter } from './instagram-shop.adapter';

@Module({
  imports: [CommonModule],
  providers: [InstagramShopAdapter],
  exports: [InstagramShopAdapter],
})
export class InstagramShopModule {}
