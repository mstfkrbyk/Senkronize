import { Module } from '@nestjs/common';

import { RakutenAdapter } from './rakuten.adapter';

@Module({
  providers: [RakutenAdapter],
  exports: [RakutenAdapter],
})
export class RakutenModule {}
