import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TradeindiaAdapter } from './tradeindia.adapter';

@Module({
  imports: [CommonModule],
  providers: [TradeindiaAdapter],
  exports: [TradeindiaAdapter],
})
export class TradeindiaModule {}
