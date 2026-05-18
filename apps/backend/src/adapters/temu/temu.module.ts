import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TemuAdapter } from './temu.adapter';

@Module({
  imports: [CommonModule],
  providers: [TemuAdapter],
  exports: [TemuAdapter],
})
export class TemuModule {}
