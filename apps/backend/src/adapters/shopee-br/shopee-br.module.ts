import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopeeBrAdapter } from './shopee-br.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopeeBrAdapter],
  exports: [ShopeeBrAdapter],
})
export class ShopeeBrModule {}
