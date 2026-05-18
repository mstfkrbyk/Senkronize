import { Module } from '@nestjs/common';

import { CdiscountAdapter } from './cdiscount.adapter';

@Module({
  providers: [CdiscountAdapter],
  exports: [CdiscountAdapter],
})
export class CdiscountModule {}
