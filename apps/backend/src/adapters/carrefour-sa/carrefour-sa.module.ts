import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CarrefourSaAdapter } from './carrefour-sa.adapter';

@Module({
  imports: [CommonModule],
  providers: [CarrefourSaAdapter],
  exports: [CarrefourSaAdapter],
})
export class CarrefourSaModule {}
