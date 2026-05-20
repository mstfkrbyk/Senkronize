import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SaleorAdapter } from './saleor.adapter';

@Module({
  imports: [CommonModule],
  providers: [SaleorAdapter],
  exports: [SaleorAdapter],
})
export class SaleorModule {}
