import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';

@Global()
@Module({
  providers: [
    TrendyolAdapter,
    HepsiburadaAdapter,
    BizimHesapAdapter,
    ParasutAdapter,
    LogoAdapter,
    MikroAdapter,
    LucaAdapter,
    TsoftAdapter,
    TicimaxAdapter,
    AdapterRegistry,
  ],
  exports: [
    AdapterRegistry,
    TrendyolAdapter,
    HepsiburadaAdapter,
    BizimHesapAdapter,
    ParasutAdapter,
    LogoAdapter,
    MikroAdapter,
    LucaAdapter,
    TsoftAdapter,
    TicimaxAdapter,
  ],
})
export class AdapterModule {}
