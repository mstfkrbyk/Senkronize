import { Module } from '@nestjs/common';

import { MysoftAdapter } from './mysoft.adapter';

@Module({
  providers: [MysoftAdapter],
  exports: [MysoftAdapter],
})
export class MysoftModule {}
