import { Module } from '@nestjs/common';

import { EbaAdapter } from './eba.adapter';

@Module({
  providers: [EbaAdapter],
  exports: [EbaAdapter],
})
export class EbaModule {}
