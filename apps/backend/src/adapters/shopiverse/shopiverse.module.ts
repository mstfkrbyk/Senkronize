import { Module } from '@nestjs/common';

import { ShopiverseAdapter } from './shopiverse.adapter';

@Module({
  providers: [ShopiverseAdapter],
  exports: [ShopiverseAdapter],
})
export class ShopiverseModule {}
