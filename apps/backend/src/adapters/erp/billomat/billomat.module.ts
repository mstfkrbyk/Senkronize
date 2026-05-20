import { Module } from '@nestjs/common';

import { BillomatErpAdapter } from './billomat.adapter';

@Module({
  providers: [BillomatErpAdapter],
  exports: [BillomatErpAdapter],
})
export class BillomatModule {}
