import { Module } from '@nestjs/common';

import { WaveAccountingErpAdapter } from './wave-accounting.adapter';

@Module({
  providers: [WaveAccountingErpAdapter],
  exports: [WaveAccountingErpAdapter],
})
export class WaveAccountingModule {}
