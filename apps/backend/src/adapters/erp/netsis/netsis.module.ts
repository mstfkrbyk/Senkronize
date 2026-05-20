import { Module } from '@nestjs/common';

import { NetsisErpAdapter } from './netsis.adapter';

@Module({
  providers: [NetsisErpAdapter],
  exports: [NetsisErpAdapter],
})
export class NetsisErpModule {}
