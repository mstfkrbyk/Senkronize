import { Module } from '@nestjs/common';

import { ReactionCommerceEcommerceAdapter } from './reaction-commerce-ecommerce.adapter';

@Module({
  providers: [ReactionCommerceEcommerceAdapter],
  exports: [ReactionCommerceEcommerceAdapter],
})
export class ReactionCommerceEcommerceModule {}
