import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BoynerModule } from './boyner/boyner.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DolapModule } from './dolap/dolap.module';
import { EbayModule } from './ebay/ebay.module';
import { EtsyModule } from './etsy/etsy.module';
import { GetirModule } from './getir/getir.module';
import { GratisModule } from './gratis/gratis.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MorhipoModule } from './morhipo/morhipo.module';
import { N11Adapter } from './n11/n11.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { TemuModule } from './temu/temu.module';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';

@Global()
@Module({
  imports: [
    GetirModule,
    GratisModule,
    BoynerModule,
    MorhipoModule,
    DolapModule,
    EbayModule,
    EtsyModule,
    TemuModule,
    SahibindenModule,
  ],
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
    PazaramaAdapter,
    WoocommerceAdapter,
    ShopifyAdapter,
    NetsisAdapter,
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
    PazaramaAdapter,
    WoocommerceAdapter,
    ShopifyAdapter,
    NetsisAdapter,
    GetirModule,
    GratisModule,
    BoynerModule,
    MorhipoModule,
    DolapModule,
    EbayModule,
    EtsyModule,
    TemuModule,
    SahibindenModule,
  ],
})
export class AdapterModule {}
