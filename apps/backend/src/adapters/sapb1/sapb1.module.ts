import { Module } from '@nestjs/common';

import { SapB1Adapter } from './sapb1.adapter';

@Module({
  providers: [SapB1Adapter],
  exports: [SapB1Adapter],
})
export class SapB1Module {}
