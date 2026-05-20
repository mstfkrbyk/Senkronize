import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LiverpoolMxAdapter } from './liverpool-mx.adapter';

@Module({
  imports: [CommonModule],
  providers: [LiverpoolMxAdapter],
  exports: [LiverpoolMxAdapter],
})
export class LiverpoolMxModule {}
