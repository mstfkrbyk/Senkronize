import { Module } from '@nestjs/common';

import { EmagAdapter } from './emag.adapter';

@Module({
  providers: [EmagAdapter],
  exports: [EmagAdapter],
})
export class EmagModule {}
