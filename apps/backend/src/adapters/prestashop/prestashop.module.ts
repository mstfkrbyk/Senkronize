import { Module } from '@nestjs/common';

import { PrestashopAdapter } from './prestashop.adapter';

@Module({
  providers: [PrestashopAdapter],
  exports: [PrestashopAdapter],
})
export class PrestashopModule {}
