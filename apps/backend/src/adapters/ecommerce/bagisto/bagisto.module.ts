import { Module } from '@nestjs/common';

import { BagistoEcommerceAdapter } from './bagisto-ecommerce.adapter';

@Module({
  providers: [BagistoEcommerceAdapter],
  exports: [BagistoEcommerceAdapter],
})
export class BagistoEcommerceModule {}
