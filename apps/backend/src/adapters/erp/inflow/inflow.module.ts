import { Module } from '@nestjs/common';

import { InflowErpAdapter } from './inflow.adapter';

@Module({
  providers: [InflowErpAdapter],
  exports: [InflowErpAdapter],
})
export class InflowModule {}
