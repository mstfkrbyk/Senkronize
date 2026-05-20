import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JumiaEtAdapter } from './jumia-et.adapter';

@Module({
  imports: [CommonModule],
  providers: [JumiaEtAdapter],
  exports: [JumiaEtAdapter],
})
export class JumiaEtModule {}
