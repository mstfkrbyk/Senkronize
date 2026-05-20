import { Module } from '@nestjs/common';

import { GittigidiyorShopEcommerceAdapter } from './gittigidiyor-shop-ecommerce.adapter';

@Module({
  providers: [GittigidiyorShopEcommerceAdapter],
  exports: [GittigidiyorShopEcommerceAdapter],
})
export class GittigidiyorShopEcommerceModule {}
