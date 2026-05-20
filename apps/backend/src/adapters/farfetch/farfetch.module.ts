import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FarfetchAdapter } from './farfetch.adapter';

@Module({
  imports: [CommonModule],
  providers: [FarfetchAdapter],
  exports: [FarfetchAdapter],
})
export class FarfetchModule {}
