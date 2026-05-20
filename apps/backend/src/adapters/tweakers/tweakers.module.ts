import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TweakersAdapter } from './tweakers.adapter';

@Module({
  imports: [CommonModule],
  providers: [TweakersAdapter],
  exports: [TweakersAdapter],
})
export class TweakersModule {}
