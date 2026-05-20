import { Module } from '@nestjs/common';

import { Pazar365Adapter } from './pazar365.adapter';

@Module({
  providers: [Pazar365Adapter],
  exports: [Pazar365Adapter],
})
export class Pazar365Module {}
