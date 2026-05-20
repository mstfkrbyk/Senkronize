import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GmarketAdapter } from './gmarket.adapter';

@Module({
  imports: [CommonModule],
  providers: [GmarketAdapter],
  exports: [GmarketAdapter],
})
export class GmarketModule {}
