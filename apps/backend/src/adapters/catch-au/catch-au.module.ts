import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CatchAuAdapter } from './catch-au.adapter';

@Module({
  imports: [CommonModule],
  providers: [CatchAuAdapter],
  exports: [CatchAuAdapter],
})
export class CatchAuModule {}
