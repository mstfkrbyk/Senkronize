import { Module } from '@nestjs/common';

import { AimeosEcommerceAdapter } from './aimeos-ecommerce.adapter';

@Module({
  providers: [AimeosEcommerceAdapter],
  exports: [AimeosEcommerceAdapter],
})
export class AimeosEcommerceModule {}
