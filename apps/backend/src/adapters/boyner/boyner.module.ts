import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BoynerAdapter } from './boyner.adapter';

@Module({
  imports: [CommonModule],
  providers: [BoynerAdapter],
  exports: [BoynerAdapter],
})
export class BoynerModule {}
