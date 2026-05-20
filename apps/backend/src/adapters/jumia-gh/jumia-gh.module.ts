import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JumiaGhAdapter } from './jumia-gh.adapter';

@Module({
  imports: [CommonModule],
  providers: [JumiaGhAdapter],
  exports: [JumiaGhAdapter],
})
export class JumiaGhModule {}
