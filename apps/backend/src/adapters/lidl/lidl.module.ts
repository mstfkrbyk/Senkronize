import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LidlAdapter } from './lidl.adapter';

@Module({
  imports: [CommonModule],
  providers: [LidlAdapter],
  exports: [LidlAdapter],
})
export class LidlModule {}
