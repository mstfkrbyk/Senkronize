import { Module } from '@nestjs/common';

import { VtexEcommerceAdapter } from './vtex-ecommerce.adapter';

@Module({
  providers: [VtexEcommerceAdapter],
  exports: [VtexEcommerceAdapter],
})
export class VtexEcommerceModule {}
