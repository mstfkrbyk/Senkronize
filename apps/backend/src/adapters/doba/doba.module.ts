import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DobaAdapter } from './doba.adapter';

@Module({
  imports: [CommonModule],
  providers: [DobaAdapter],
  exports: [DobaAdapter],
})
export class DobaModule {}
