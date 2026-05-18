import { Module } from '@nestjs/common';

import { FaprikaAdapter } from './faprika.adapter';

@Module({
  providers: [FaprikaAdapter],
  exports: [FaprikaAdapter],
})
export class FaprikaModule {}
