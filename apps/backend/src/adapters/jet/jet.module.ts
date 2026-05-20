import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JetAdapter } from './jet.adapter';

@Module({
  imports: [CommonModule],
  providers: [JetAdapter],
  exports: [JetAdapter],
})
export class JetModule {}
