import { Module } from '@nestjs/common';

import { MercadolibreAdapter } from './mercadolibre.adapter';

@Module({
  providers: [MercadolibreAdapter],
  exports: [MercadolibreAdapter],
})
export class MercadolibreModule {}
