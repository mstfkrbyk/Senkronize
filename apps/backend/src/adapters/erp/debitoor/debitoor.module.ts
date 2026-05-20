import { Module } from '@nestjs/common';

import { DebitoorErpAdapter } from './debitoor.adapter';

@Module({
  providers: [DebitoorErpAdapter],
  exports: [DebitoorErpAdapter],
})
export class DebitoorModule {}
