import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { OverstockAdapter } from './overstock.adapter';

@Module({
  imports: [CommonModule],
  providers: [OverstockAdapter],
  exports: [OverstockAdapter],
})
export class OverstockModule {}
