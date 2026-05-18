import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MercadolibreAdapter } from './mercadolibre.adapter';

@Module({
  imports: [CommonModule],
  providers: [MercadolibreAdapter],
  exports: [MercadolibreAdapter],
})
export class MercadolibreModule {}
