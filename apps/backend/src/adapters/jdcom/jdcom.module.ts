import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JdcomAdapter } from './jdcom.adapter';

@Module({
  imports: [CommonModule],
  providers: [JdcomAdapter],
  exports: [JdcomAdapter],
})
export class JdcomModule {}
