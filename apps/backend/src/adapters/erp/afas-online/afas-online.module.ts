import { Module } from '@nestjs/common';

import { AfasOnlineErpAdapter } from './afas-online.adapter';

@Module({
  providers: [AfasOnlineErpAdapter],
  exports: [AfasOnlineErpAdapter],
})
export class AfasOnlineModule {}
