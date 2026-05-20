import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KakaoCommerceAdapter } from './kakao-commerce.adapter';

@Module({
  imports: [CommonModule],
  providers: [KakaoCommerceAdapter],
  exports: [KakaoCommerceAdapter],
})
export class KakaoCommerceModule {}
