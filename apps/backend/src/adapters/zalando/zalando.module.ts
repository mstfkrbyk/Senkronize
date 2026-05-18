import { Module } from '@nestjs/common';

import { ZalandoAdapter } from './zalando.adapter';

@Module({
  providers: [ZalandoAdapter],
  exports: [ZalandoAdapter],
})
export class ZalandoModule {}
