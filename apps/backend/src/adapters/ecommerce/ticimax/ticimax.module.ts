import { Module } from '@nestjs/common';

import { TicimaxEcommerceAdapter } from './ticimax.adapter';

@Module({
  providers: [TicimaxEcommerceAdapter],
  exports: [TicimaxEcommerceAdapter],
})
export class TicimaxEcommerceModule {}
