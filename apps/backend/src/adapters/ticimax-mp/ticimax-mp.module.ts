import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TicimaxMpAdapter } from './ticimax-mp.adapter';

@Module({
  imports: [CommonModule],
  providers: [TicimaxMpAdapter],
  exports: [TicimaxMpAdapter],
})
export class TicimaxMpModule {}
