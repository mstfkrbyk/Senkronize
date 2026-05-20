import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PoshmarkAdapter } from './poshmark.adapter';

@Module({
  imports: [CommonModule],
  providers: [PoshmarkAdapter],
  exports: [PoshmarkAdapter],
})
export class PoshmarkModule {}
