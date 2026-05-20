import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TikiAdapter } from './tiki.adapter';

@Module({
  imports: [CommonModule],
  providers: [TikiAdapter],
  exports: [TikiAdapter],
})
export class TikiModule {}
