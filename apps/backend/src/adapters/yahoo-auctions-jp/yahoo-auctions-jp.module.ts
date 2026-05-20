import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { YahooAuctionsJpAdapter } from './yahoo-auctions-jp.adapter';

@Module({
  imports: [CommonModule],
  providers: [YahooAuctionsJpAdapter],
  exports: [YahooAuctionsJpAdapter],
})
export class YahooAuctionsJpModule {}
