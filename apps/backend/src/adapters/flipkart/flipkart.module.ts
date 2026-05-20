import { Module } from '@nestjs/common';

import { FlipkartAdapter } from './flipkart.adapter';

@Module({
  providers: [FlipkartAdapter],
  exports: [FlipkartAdapter],
})
export class FlipkartModule {}
