import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AlibabaAdapter } from './alibaba.adapter';

@Module({
  imports: [CommonModule],
  providers: [AlibabaAdapter],
  exports: [AlibabaAdapter],
})
export class AlibabaModule {}
