import { Module } from '@nestjs/common';

import { ShopifyTrEcommerceAdapter } from './shopify-tr-ecommerce.adapter';

@Module({
  providers: [ShopifyTrEcommerceAdapter],
  exports: [ShopifyTrEcommerceAdapter],
})
export class ShopifyTrEcommerceModule {}
