import { Module } from '@nestjs/common';

import { ElasticPathEcommerceAdapter } from './elastic-path-ecommerce.adapter';

@Module({
  providers: [ElasticPathEcommerceAdapter],
  exports: [ElasticPathEcommerceAdapter],
})
export class ElasticPathEcommerceModule {}
