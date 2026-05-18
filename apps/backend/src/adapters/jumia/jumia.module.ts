import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JumiaAdapter } from './jumia.adapter';

@Module({
  imports: [CommonModule],
  providers: [JumiaAdapter],
  exports: [JumiaAdapter],
})
export class JumiaModule {}
