import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { StripeAdapter } from './stripe.adapter';

@Module({
  imports: [CommonModule],
  providers: [StripeAdapter],
  exports: [StripeAdapter],
})
export class StripeModule {}
