import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TrademeAdapter } from './trademe.adapter';

@Module({
  imports: [CommonModule],
  providers: [TrademeAdapter],
  exports: [TrademeAdapter],
})
export class TrademeModule {}
