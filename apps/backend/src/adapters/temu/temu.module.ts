import { Module } from '@nestjs/common';

import { TemuAdapter } from './temu.adapter';

@Module({
  providers: [TemuAdapter],
  exports: [TemuAdapter],
})
export class TemuModule {}
