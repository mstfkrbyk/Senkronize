import { Module } from '@nestjs/common';

import { DecathlonAdapter } from './decathlon.adapter';

@Module({
  providers: [DecathlonAdapter],
  exports: [DecathlonAdapter],
})
export class DecathlonModule {}
