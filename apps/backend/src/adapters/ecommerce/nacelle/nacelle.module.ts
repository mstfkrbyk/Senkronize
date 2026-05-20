import { Module } from '@nestjs/common';

import { NacelleEcommerceAdapter } from './nacelle-ecommerce.adapter';

@Module({
  providers: [NacelleEcommerceAdapter],
  exports: [NacelleEcommerceAdapter],
})
export class NacelleEcommerceModule {}
