import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { YoutubeShopAdapter } from './youtube-shop.adapter';

@Module({
  imports: [CommonModule],
  providers: [YoutubeShopAdapter],
  exports: [YoutubeShopAdapter],
})
export class YoutubeShopModule {}
