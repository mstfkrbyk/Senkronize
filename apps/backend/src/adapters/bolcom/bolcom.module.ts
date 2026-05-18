import { Module } from '@nestjs/common';

import { BolcomAdapter } from './bolcom.adapter';

@Module({
  providers: [BolcomAdapter],
  exports: [BolcomAdapter],
})
export class BolcomModule {}
