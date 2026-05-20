import { Module } from '@nestjs/common';

import { HoldedErpAdapter } from './holded.adapter';

@Module({
  providers: [HoldedErpAdapter],
  exports: [HoldedErpAdapter],
})
export class HoldedModule {}
