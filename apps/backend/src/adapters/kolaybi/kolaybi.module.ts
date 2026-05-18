import { Module } from '@nestjs/common';

import { KolaybiAdapter } from './kolaybi.adapter';

@Module({
  providers: [KolaybiAdapter],
  exports: [KolaybiAdapter],
})
export class KolaybiModule {}
