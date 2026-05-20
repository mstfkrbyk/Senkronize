import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AlibabaB2bAdapter } from './alibaba-b2b.adapter';

@Module({
  imports: [CommonModule],
  providers: [AlibabaB2bAdapter],
  exports: [AlibabaB2bAdapter],
})
export class AlibabaB2bModule {}
