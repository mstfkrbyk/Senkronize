import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';

@Global()
@Module({
  providers: [TrendyolAdapter, HepsiburadaAdapter, AdapterRegistry],
  exports: [AdapterRegistry, TrendyolAdapter, HepsiburadaAdapter],
})
export class AdapterModule {}
