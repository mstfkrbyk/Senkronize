import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TuttiChAdapter } from './tutti-ch.adapter';

@Module({
  imports: [CommonModule],
  providers: [TuttiChAdapter],
  exports: [TuttiChAdapter],
})
export class TuttiChModule {}
