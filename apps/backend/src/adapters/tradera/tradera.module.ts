import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TraderaAdapter } from './tradera.adapter';

@Module({
  imports: [CommonModule],
  providers: [TraderaAdapter],
  exports: [TraderaAdapter],
})
export class TraderaModule {}
