import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { N11Adapter } from './n11/n11.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';

@Global()
@Module({
  providers: [
    AmazonAdapter,
    TrendyolAdapter,
    HepsiburadaAdapter,
    N11Adapter,
    CiceksepetiAdapter,
    IdeasoftAdapter,
    BizimHesapAdapter,
    ParasutAdapter,
    LogoAdapter,
    MikroAdapter,
    LucaAdapter,
    TsoftAdapter,
    TicimaxAdapter,
    PttavmAdapter,
    WoocommerceAdapter,
    ShopifyAdapter,
    AdapterRegistry,
  ],
  exports: [
    AdapterRegistry,
    AmazonAdapter,
    TrendyolAdapter,
    HepsiburadaAdapter,
    N11Adapter,
    CiceksepetiAdapter,
    IdeasoftAdapter,
    BizimHesapAdapter,
    ParasutAdapter,
    LogoAdapter,
    MikroAdapter,
    LucaAdapter,
    TsoftAdapter,
    TicimaxAdapter,
    PttavmAdapter,
    WoocommerceAdapter,
    ShopifyAdapter,
  ],
})
export class AdapterModule {}
