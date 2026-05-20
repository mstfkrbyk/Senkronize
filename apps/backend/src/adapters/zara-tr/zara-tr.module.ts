import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ZaraTrAdapter } from './zara-tr.adapter';

@Module({
  imports: [CommonModule],
  providers: [ZaraTrAdapter],
  exports: [ZaraTrAdapter],
})
export class ZaraTrModule {}
