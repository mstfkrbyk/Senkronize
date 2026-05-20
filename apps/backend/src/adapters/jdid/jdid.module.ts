import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JdidAdapter } from './jdid.adapter';

@Module({
  imports: [CommonModule],
  providers: [JdidAdapter],
  exports: [JdidAdapter],
})
export class JdidModule {}
