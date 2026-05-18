import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KotonAdapter } from './koton.adapter';

@Module({
  imports: [CommonModule],
  providers: [KotonAdapter],
  exports: [KotonAdapter],
})
export class KotonModule {}
