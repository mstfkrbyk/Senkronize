import { Module } from '@nestjs/common';

import { CommercejsEcommerceAdapter } from './commercejs-ecommerce.adapter';

@Module({
  providers: [CommercejsEcommerceAdapter],
  exports: [CommercejsEcommerceAdapter],
})
export class CommercejsEcommerceModule {}
