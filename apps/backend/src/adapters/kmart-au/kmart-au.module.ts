import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KmartAuAdapter } from './kmart-au.adapter';

@Module({
  imports: [CommonModule],
  providers: [KmartAuAdapter],
  exports: [KmartAuAdapter],
})
export class KmartAuModule {}
