import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KilimallAdapter } from './kilimall.adapter';

@Module({
  imports: [CommonModule],
  providers: [KilimallAdapter],
  exports: [KilimallAdapter],
})
export class KilimallModule {}
