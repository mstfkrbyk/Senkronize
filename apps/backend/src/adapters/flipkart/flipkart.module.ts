import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FlipkartAdapter } from './flipkart.adapter';

@Module({
  imports: [CommonModule],
  providers: [FlipkartAdapter],
  exports: [FlipkartAdapter],
})
export class FlipkartModule {}
