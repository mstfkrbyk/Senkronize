import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LcwaikikiAdapter } from './lcwaikiki.adapter';

@Module({
  imports: [CommonModule],
  providers: [LcwaikikiAdapter],
  exports: [LcwaikikiAdapter],
})
export class LcwaikikiModule {}
