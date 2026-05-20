import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { WalmartAdapter } from './walmart.adapter';

@Module({
  imports: [CommonModule],
  providers: [WalmartAdapter],
  exports: [WalmartAdapter],
})
export class WalmartModule {}
