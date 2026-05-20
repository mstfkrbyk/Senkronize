import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { NetAPorterAdapter } from './net-a-porter.adapter';

@Module({
  imports: [CommonModule],
  providers: [NetAPorterAdapter],
  exports: [NetAPorterAdapter],
})
export class NetAPorterModule {}
