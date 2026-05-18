import { Module } from '@nestjs/common';

import { AmazonEuAdapter } from './amazon-eu.adapter';

@Module({
  providers: [AmazonEuAdapter],
  exports: [AmazonEuAdapter],
})
export class AmazonEuModule {}
