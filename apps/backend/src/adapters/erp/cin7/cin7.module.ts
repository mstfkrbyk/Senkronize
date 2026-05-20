import { Module } from '@nestjs/common';

import { Cin7ErpAdapter } from './cin7.adapter';

@Module({
  providers: [Cin7ErpAdapter],
  exports: [Cin7ErpAdapter],
})
export class Cin7Module {}
