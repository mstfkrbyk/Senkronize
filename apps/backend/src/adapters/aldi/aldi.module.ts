import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AldiAdapter } from './aldi.adapter';

@Module({
  imports: [CommonModule],
  providers: [AldiAdapter],
  exports: [AldiAdapter],
})
export class AldiModule {}
