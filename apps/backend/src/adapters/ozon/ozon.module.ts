import { Module } from '@nestjs/common';

import { OzonAdapter } from './ozon.adapter';

@Module({
  providers: [OzonAdapter],
  exports: [OzonAdapter],
})
export class OzonModule {}
