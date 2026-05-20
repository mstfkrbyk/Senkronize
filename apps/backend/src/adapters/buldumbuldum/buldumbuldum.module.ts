import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BuldumbuldumAdapter } from './buldumbuldum.adapter';

@Module({
  imports: [CommonModule],
  providers: [BuldumbuldumAdapter],
  exports: [BuldumbuldumAdapter],
})
export class BuldumbuldumModule {}
