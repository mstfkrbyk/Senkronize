import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DopingAdapter } from './doping.adapter';

@Module({
  imports: [CommonModule],
  providers: [DopingAdapter],
  exports: [DopingAdapter],
})
export class DopingModule {}
