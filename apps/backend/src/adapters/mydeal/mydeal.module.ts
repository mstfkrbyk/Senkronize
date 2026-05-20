import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MydealAdapter } from './mydeal.adapter';

@Module({
  imports: [CommonModule],
  providers: [MydealAdapter],
  exports: [MydealAdapter],
})
export class MydealModule {}
