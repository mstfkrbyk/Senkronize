import { Module } from '@nestjs/common';

import { ExactOnlineErpAdapter } from './exact-online.adapter';

@Module({
  providers: [ExactOnlineErpAdapter],
  exports: [ExactOnlineErpAdapter],
})
export class ExactOnlineModule {}
