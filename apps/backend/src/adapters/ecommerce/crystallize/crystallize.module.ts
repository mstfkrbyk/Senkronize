import { Module } from '@nestjs/common';

import { CrystallizeEcommerceAdapter } from './crystallize-ecommerce.adapter';

@Module({
  providers: [CrystallizeEcommerceAdapter],
  exports: [CrystallizeEcommerceAdapter],
})
export class CrystallizeEcommerceModule {}
