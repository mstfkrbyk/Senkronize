import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CarrefourMeAdapter } from './carrefour-me.adapter';

@Module({
  imports: [CommonModule],
  providers: [CarrefourMeAdapter],
  exports: [CarrefourMeAdapter],
})
export class CarrefourMeModule {}
