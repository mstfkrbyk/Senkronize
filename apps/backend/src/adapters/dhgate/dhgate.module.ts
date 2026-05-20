import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DhgateAdapter } from './dhgate.adapter';

@Module({
  imports: [CommonModule],
  providers: [DhgateAdapter],
  exports: [DhgateAdapter],
})
export class DhgateModule {}
