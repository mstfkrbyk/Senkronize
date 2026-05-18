import { Module } from '@nestjs/common';

import { EtaAdapter } from './eta.adapter';

@Module({
  providers: [EtaAdapter],
  exports: [EtaAdapter],
})
export class EtaModule {}
