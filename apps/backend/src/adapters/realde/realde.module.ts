import { Module } from '@nestjs/common';

import { RealdeAdapter } from './realde.adapter';

@Module({
  providers: [RealdeAdapter],
  exports: [RealdeAdapter],
})
export class RealdeModule {}
