import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DbaAdapter } from './dba.adapter';

@Module({
  imports: [CommonModule],
  providers: [DbaAdapter],
  exports: [DbaAdapter],
})
export class DbaModule {}
