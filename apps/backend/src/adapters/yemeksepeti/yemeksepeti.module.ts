import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { YemeksepetiAdapter } from './yemeksepeti.adapter';

@Module({
  imports: [CommonModule],
  providers: [YemeksepetiAdapter],
  exports: [YemeksepetiAdapter],
})
export class YemeksepetiModule {}
