import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MigrosAdapter } from './migros.adapter';

@Module({
  imports: [CommonModule],
  providers: [MigrosAdapter],
  exports: [MigrosAdapter],
})
export class MigrosModule {}
