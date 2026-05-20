import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { RipleyAdapter } from './ripley.adapter';

@Module({
  imports: [CommonModule],
  providers: [RipleyAdapter],
  exports: [RipleyAdapter],
})
export class RipleyModule {}
