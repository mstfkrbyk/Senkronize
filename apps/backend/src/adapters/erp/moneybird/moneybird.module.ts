import { Module } from '@nestjs/common';

import { MoneybirdErpAdapter } from './moneybird.adapter';

@Module({
  providers: [MoneybirdErpAdapter],
  exports: [MoneybirdErpAdapter],
})
export class MoneybirdModule {}
