import { Module } from '@nestjs/common';

import { ZaraAdapter } from './zara.adapter';

@Module({
  providers: [ZaraAdapter],
  exports: [ZaraAdapter],
})
export class ZaraModule {}
