import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KaspiAdapter } from './kaspi.adapter';

@Module({
  imports: [CommonModule],
  providers: [KaspiAdapter],
  exports: [KaspiAdapter],
})
export class KaspiModule {}
