import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LazadaMyAdapter } from './lazada-my.adapter';

@Module({
  imports: [CommonModule],
  providers: [LazadaMyAdapter],
  exports: [LazadaMyAdapter],
})
export class LazadaMyModule {}
