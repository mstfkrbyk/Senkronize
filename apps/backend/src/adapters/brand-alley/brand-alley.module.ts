import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BrandAlleyAdapter } from './brand-alley.adapter';

@Module({
  imports: [CommonModule],
  providers: [BrandAlleyAdapter],
  exports: [BrandAlleyAdapter],
})
export class BrandAlleyModule {}
