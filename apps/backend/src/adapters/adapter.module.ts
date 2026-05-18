import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { AkinonModule } from './akinon/akinon.module';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BoynerModule } from './boyner/boyner.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoModule } from './defacto/defacto.module';
import { DolapModule } from './dolap/dolap.module';
import { EbayModule } from './ebay/ebay.module';
import { EtsyModule } from './etsy/etsy.module';
import { FaprikaModule } from './faprika/faprika.module';
import { FloModule } from './flo/flo.module';
import { GetirModule } from './getir/getir.module';
import { GratisModule } from './gratis/gratis.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiexpressModule } from './hepsiexpress/hepsiexpress.module';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IkasModule } from './ikas/ikas.module';
import { KotonModule } from './koton/koton.module';
import { LcwaikikiModule } from './lcwaikiki/lcwaikiki.module';
import { LogoAdapter } from './logo/logo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MagentoModule } from './magento/magento.module';
import { MaviModule } from './mavi/mavi.module';
import { MediamarktModule } from './mediamarkt/mediamarkt.module';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MigrosModule } from './migros/migros.module';
import { MorhipoModule } from './morhipo/morhipo.module';
import { N11Adapter } from './n11/n11.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { OpencartModule } from './opencart/opencart.module';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PrestashopModule } from './prestashop/prestashop.module';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { TeknosaModule } from './teknosa/teknosa.module';
import { TemuModule } from './temu/temu.module';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { UniposModule } from './unipos/unipos.module';
import { VatanModule } from './vatan/vatan.module';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';

@Global()
@Module({
  imports: [
    AkinonModule,
    BoynerModule,
    DefactoModule,
    DolapModule,
    EbayModule,
    EtsyModule,
    FaprikaModule,
    FloModule,
    GetirModule,
    GratisModule,
    HepsiexpressModule,
    IkasModule,
    KotonModule,
    LcwaikikiModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MigrosModule,
    MorhipoModule,
    OpencartModule,
    PrestashopModule,
    SahibindenModule,
    TeknosaModule,
    TemuModule,
    UniposModule,
    VatanModule,
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
    AkinonModule,
    BoynerModule,
    DefactoModule,
    DolapModule,
    EbayModule,
    EtsyModule,
    FaprikaModule,
    FloModule,
    GetirModule,
    GratisModule,
    HepsiexpressModule,
    IkasModule,
    KotonModule,
    LcwaikikiModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MigrosModule,
    MorhipoModule,
    OpencartModule,
    PrestashopModule,
    SahibindenModule,
    TeknosaModule,
    TemuModule,
    UniposModule,
    VatanModule,
  ],
})
export class AdapterModule {}
