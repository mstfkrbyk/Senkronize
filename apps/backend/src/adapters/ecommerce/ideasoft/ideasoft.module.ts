import { Module } from '@nestjs/common';

import { IdeasoftEcommerceAdapter } from './ideasoft.adapter';

@Module({
  providers: [IdeasoftEcommerceAdapter],
  exports: [IdeasoftEcommerceAdapter],
})
export class IdeasoftEcommerceModule {}
