import { Module } from '@nestjs/common';

import { AmazonAeAdapter } from './amazon-ae.adapter';

@Module({
  providers: [AmazonAeAdapter],
  exports: [AmazonAeAdapter],
})
export class AmazonAeModule {}
