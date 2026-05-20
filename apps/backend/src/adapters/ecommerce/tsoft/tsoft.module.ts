import { Module } from '@nestjs/common';

import { TsoftEcommerceAdapter } from './tsoft.adapter';

@Module({
  providers: [TsoftEcommerceAdapter],
  exports: [TsoftEcommerceAdapter],
})
export class TsoftEcommerceModule {}
