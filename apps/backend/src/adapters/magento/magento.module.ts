import { Module } from '@nestjs/common';

import { MagentoAdapter } from './magento.adapter';

@Module({
  providers: [MagentoAdapter],
  exports: [MagentoAdapter],
})
export class MagentoModule {}
