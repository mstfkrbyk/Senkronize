import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CarrefourFrAdapter } from './carrefour-fr.adapter';

@Module({
  imports: [CommonModule],
  providers: [CarrefourFrAdapter],
  exports: [CarrefourFrAdapter],
})
export class CarrefourFrModule {}
