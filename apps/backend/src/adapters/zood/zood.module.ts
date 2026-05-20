import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ZoodAdapter } from './zood.adapter';

@Module({
  imports: [CommonModule],
  providers: [ZoodAdapter],
  exports: [ZoodAdapter],
})
export class ZoodModule {}
