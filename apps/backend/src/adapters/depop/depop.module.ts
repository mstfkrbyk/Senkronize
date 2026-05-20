import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DepopAdapter } from './depop.adapter';

@Module({
  imports: [CommonModule],
  providers: [DepopAdapter],
  exports: [DepopAdapter],
})
export class DepopModule {}
