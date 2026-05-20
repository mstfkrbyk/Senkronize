import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SharafDgAdapter } from './sharaf-dg.adapter';

@Module({
  imports: [CommonModule],
  providers: [SharafDgAdapter],
  exports: [SharafDgAdapter],
})
export class SharafDgModule {}
