import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { EvideaAdapter } from './evidea.adapter';

@Module({
  imports: [CommonModule],
  providers: [EvideaAdapter],
  exports: [EvideaAdapter],
})
export class EvideaModule {}
