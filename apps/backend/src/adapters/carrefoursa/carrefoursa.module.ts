import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CarrefoursaAdapter } from './carrefoursa.adapter';

@Module({
  imports: [CommonModule],
  providers: [CarrefoursaAdapter],
  exports: [CarrefoursaAdapter],
})
export class CarrefoursaModule {}
