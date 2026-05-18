import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { EbayModule } from '../ebay/ebay.module';
import { GittigidiyorAdapter } from './gittigidiyor.adapter';

@Module({
  imports: [CommonModule, EbayModule],
  providers: [GittigidiyorAdapter],
  exports: [GittigidiyorAdapter],
})
export class GittigidiyorModule {}
