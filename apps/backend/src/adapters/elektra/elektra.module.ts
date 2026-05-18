import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ElektraAdapter } from './elektra.adapter';

@Module({
  imports: [CommonModule],
  providers: [ElektraAdapter],
  exports: [ElektraAdapter],
})
export class ElektraModule {}
