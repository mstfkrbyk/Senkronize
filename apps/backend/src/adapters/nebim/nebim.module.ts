import { Module } from '@nestjs/common';

import { NebimAdapter } from './nebim.adapter';

@Module({
  providers: [NebimAdapter],
  exports: [NebimAdapter],
})
export class NebimModule {}
