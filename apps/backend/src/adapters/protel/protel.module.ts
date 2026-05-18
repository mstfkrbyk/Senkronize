import { Module } from '@nestjs/common';

import { ProtelAdapter } from './protel.adapter';

@Module({
  providers: [ProtelAdapter],
  exports: [ProtelAdapter],
})
export class ProtelModule {}
