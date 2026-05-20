import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LaredouteAdapter } from './laredoute.adapter';

@Module({
  imports: [CommonModule],
  providers: [LaredouteAdapter],
  exports: [LaredouteAdapter],
})
export class LaredouteModule {}
