import { Module } from '@nestjs/common';

import { DolapAdapter } from './dolap.adapter';

@Module({
  providers: [DolapAdapter],
  exports: [DolapAdapter],
})
export class DolapModule {}
