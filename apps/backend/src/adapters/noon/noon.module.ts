import { Module } from '@nestjs/common';

import { NoonAdapter } from './noon.adapter';

@Module({
  providers: [NoonAdapter],
  exports: [NoonAdapter],
})
export class NoonModule {}
