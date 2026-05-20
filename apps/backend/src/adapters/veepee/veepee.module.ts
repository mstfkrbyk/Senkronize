import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VeepeeAdapter } from './veepee.adapter';

@Module({
  imports: [CommonModule],
  providers: [VeepeeAdapter],
  exports: [VeepeeAdapter],
})
export class VeepeeModule {}
