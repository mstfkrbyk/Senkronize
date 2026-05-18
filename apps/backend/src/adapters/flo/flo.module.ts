import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FloAdapter } from './flo.adapter';

@Module({
  imports: [CommonModule],
  providers: [FloAdapter],
  exports: [FloAdapter],
})
export class FloModule {}
