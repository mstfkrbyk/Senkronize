import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DustinAdapter } from './dustin.adapter';

@Module({
  imports: [CommonModule],
  providers: [DustinAdapter],
  exports: [DustinAdapter],
})
export class DustinModule {}
