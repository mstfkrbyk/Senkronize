import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SouqAdapter } from './souq.adapter';

@Module({
  imports: [CommonModule],
  providers: [SouqAdapter],
  exports: [SouqAdapter],
})
export class SouqModule {}
