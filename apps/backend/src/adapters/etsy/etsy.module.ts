import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { EtsyAdapter } from './etsy.adapter';

@Module({
  imports: [CommonModule],
  providers: [EtsyAdapter],
  exports: [EtsyAdapter],
})
export class EtsyModule {}
