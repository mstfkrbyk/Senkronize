import { Module } from '@nestjs/common';

import { TwinfieldErpAdapter } from './twinfield.adapter';

@Module({
  providers: [TwinfieldErpAdapter],
  exports: [TwinfieldErpAdapter],
})
export class TwinfieldModule {}
