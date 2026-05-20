import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopeeSgAdapter } from './shopee-sg.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopeeSgAdapter],
  exports: [ShopeeSgAdapter],
})
export class ShopeeSgModule {}
