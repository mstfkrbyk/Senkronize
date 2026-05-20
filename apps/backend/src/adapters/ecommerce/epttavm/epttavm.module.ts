import { Module } from '@nestjs/common';

import { EpttavmEcommerceAdapter } from './epttavm-ecommerce.adapter';

@Module({
  providers: [EpttavmEcommerceAdapter],
  exports: [EpttavmEcommerceAdapter],
})
export class EpttavmEcommerceModule {}
