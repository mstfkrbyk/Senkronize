import { Module } from '@nestjs/common';

import { MikroBulutAdapter } from './mikro-bulut.adapter';

@Module({
  providers: [MikroBulutAdapter],
  exports: [MikroBulutAdapter],
})
export class MikroBulutModule {}
