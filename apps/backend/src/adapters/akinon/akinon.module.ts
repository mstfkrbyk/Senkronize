import { Module } from '@nestjs/common';

import { AkinonAdapter } from './akinon.adapter';

@Module({
  providers: [AkinonAdapter],
  exports: [AkinonAdapter],
})
export class AkinonModule {}
