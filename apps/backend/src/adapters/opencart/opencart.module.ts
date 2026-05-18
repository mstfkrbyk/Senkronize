import { Module } from '@nestjs/common';

import { OpencartAdapter } from './opencart.adapter';

@Module({
  providers: [OpencartAdapter],
  exports: [OpencartAdapter],
})
export class OpencartModule {}
