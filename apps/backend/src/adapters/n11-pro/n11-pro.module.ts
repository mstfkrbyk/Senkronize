import { Module } from '@nestjs/common';

import { N11ProAdapter } from './n11-pro.adapter';

@Module({
  providers: [N11ProAdapter],
  exports: [N11ProAdapter],
})
export class N11ProModule {}
