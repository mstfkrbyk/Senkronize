import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SpartooAdapter } from './spartoo.adapter';

@Module({
  imports: [CommonModule],
  providers: [SpartooAdapter],
  exports: [SpartooAdapter],
})
export class SpartooModule {}
