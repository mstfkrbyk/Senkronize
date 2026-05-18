import { Module } from '@nestjs/common';

import { IdealoAdapter } from './idealo.adapter';

@Module({
  providers: [IdealoAdapter],
  exports: [IdealoAdapter],
})
export class IdealoModule {}
