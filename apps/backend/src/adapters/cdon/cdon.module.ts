import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CdonAdapter } from './cdon.adapter';

@Module({
  imports: [CommonModule],
  providers: [CdonAdapter],
  exports: [CdonAdapter],
})
export class CdonModule {}
