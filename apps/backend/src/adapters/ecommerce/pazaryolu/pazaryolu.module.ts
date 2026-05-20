import { Module } from '@nestjs/common';

import { PazaryoluEcommerceAdapter } from './pazaryolu-ecommerce.adapter';

@Module({
  providers: [PazaryoluEcommerceAdapter],
  exports: [PazaryoluEcommerceAdapter],
})
export class PazaryoluEcommerceModule {}
