import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SubmarinoAdapter } from './submarino.adapter';

@Module({
  imports: [CommonModule],
  providers: [SubmarinoAdapter],
  exports: [SubmarinoAdapter],
})
export class SubmarinoModule {}
