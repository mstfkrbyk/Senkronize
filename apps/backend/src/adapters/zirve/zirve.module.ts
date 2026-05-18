import { Module } from '@nestjs/common';

import { ZirveAdapter } from './zirve.adapter';

@Module({
  providers: [ZirveAdapter],
  exports: [ZirveAdapter],
})
export class ZirveModule {}
