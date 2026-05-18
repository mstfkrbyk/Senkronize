import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LazadaPhAdapter } from './lazada-ph.adapter';

@Module({
  imports: [CommonModule],
  providers: [LazadaPhAdapter],
  exports: [LazadaPhAdapter],
})
export class LazadaPhModule {}
