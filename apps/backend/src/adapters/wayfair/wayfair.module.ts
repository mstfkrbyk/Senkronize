import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { WayfairAdapter } from './wayfair.adapter';

@Module({
  imports: [CommonModule],
  providers: [WayfairAdapter],
  exports: [WayfairAdapter],
})
export class WayfairModule {}
