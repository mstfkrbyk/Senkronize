import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';

@Global()
@Module({
  providers: [
    TrendyolAdapter,
    HepsiburadaAdapter,
    BizimHesapAdapter,
    TsoftAdapter,
    TicimaxAdapter,
    AdapterRegistry,
  ],
  exports: [
    AdapterRegistry,
    TrendyolAdapter,
    HepsiburadaAdapter,
    BizimHesapAdapter,
    TsoftAdapter,
    TicimaxAdapter,
  ],
})
export class AdapterModule {}
