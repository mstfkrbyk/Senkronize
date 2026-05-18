import { Module } from '@nestjs/common';

import { WildberriesAdapter } from './wildberries.adapter';

@Module({
  providers: [WildberriesAdapter],
  exports: [WildberriesAdapter],
})
export class WildberriesModule {}
