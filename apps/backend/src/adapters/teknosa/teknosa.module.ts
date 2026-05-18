import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TeknosaAdapter } from './teknosa.adapter';

@Module({
  imports: [CommonModule],
  providers: [TeknosaAdapter],
  exports: [TeknosaAdapter],
})
export class TeknosaModule {}
