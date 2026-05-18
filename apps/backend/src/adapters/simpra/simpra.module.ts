import { Module } from '@nestjs/common';

import { SimpraAdapter } from './simpra.adapter';

@Module({
  providers: [SimpraAdapter],
  exports: [SimpraAdapter],
})
export class SimpraModule {}
