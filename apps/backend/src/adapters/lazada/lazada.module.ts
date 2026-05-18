import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LazadaAdapter } from './lazada.adapter';

@Module({
  imports: [CommonModule],
  providers: [LazadaAdapter],
  exports: [LazadaAdapter],
})
export class LazadaModule {}
