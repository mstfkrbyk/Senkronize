import { Module } from '@nestjs/common';

import { LogoCommerceAdapter } from './logo-commerce.adapter';

@Module({
  providers: [LogoCommerceAdapter],
  exports: [LogoCommerceAdapter],
})
export class LogoCommerceModule {}
