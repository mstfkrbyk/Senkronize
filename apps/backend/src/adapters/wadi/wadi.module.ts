import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { WadiAdapter } from './wadi.adapter';

@Module({
  imports: [CommonModule],
  providers: [WadiAdapter],
  exports: [WadiAdapter],
})
export class WadiModule {}
