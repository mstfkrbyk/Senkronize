import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { A101Module } from './a101/a101.module';
import { AkinonModule } from './akinon/akinon.module';
import { ArcelikModule } from './arcelik/arcelik.module';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonEuModule } from './amazon-eu/amazon-eu.module';
import { AllegroModule } from './allegro/allegro.module';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BanabiModule } from './banabi/banabi.module';
import { BimakilliModule } from './bimakilli/bimakilli.module';
import { BoynerModule } from './boyner/boyner.module';
import { CdiscountModule } from './cdiscount/cdiscount.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoModule } from './defacto/defacto.module';
import { DolapModule } from './dolap/dolap.module';
import { ElektraModule } from './elektra/elektra.module';
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
import { KauflandModule } from './kaufland/kaufland.module';
import { KotonModule } from './koton/koton.module';
import { LcwaikikiModule } from './lcwaikiki/lcwaikiki.module';
import { LogoAdapter } from './logo/logo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MagentoModule } from './magento/magento.module';
import { MaviModule } from './mavi/mavi.module';
import { MediamarktModule } from './mediamarkt/mediamarkt.module';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MigrosModule } from './migros/migros.module';
import { MigroshemenModule } from './migroshemen/migroshemen.module';
import { MorhipoModule } from './morhipo/morhipo.module';
import { N11Adapter } from './n11/n11.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NoonModule } from './noon/noon.module';
import { OpencartModule } from './opencart/opencart.module';
import { OzonModule } from './ozon/ozon.module';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PrestashopModule } from './prestashop/prestashop.module';
import { RobomarktModule } from './robomarkt/robomarkt.module';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { ShopigoModule } from './shopigo/shopigo.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { TeknosaModule } from './teknosa/teknosa.module';
import { TrendyolGoModule } from './trendyol-go/trendyol-go.module';
import { TemuModule } from './temu/temu.module';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { UniposModule } from './unipos/unipos.module';
import { VatanModule } from './vatan/vatan.module';
import { VestelModule } from './vestel/vestel.module';
import { WildberriesModule } from './wildberries/wildberries.module';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';

@Global()
@Module({
  imports: [
    A101Module,
    AkinonModule,
    AllegroModule,
    AmazonEuModule,
    ArcelikModule,
    BanabiModule,
    BimakilliModule,
    BoynerModule,
    CdiscountModule,
    DefactoModule,
    DolapModule,
    EbayModule,
    ElektraModule,
    EtsyModule,
    FaprikaModule,
    FloModule,
    GetirModule,
    GratisModule,
    HepsiexpressModule,
    IkasModule,
    KauflandModule,
    KotonModule,
    LcwaikikiModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MigrosModule,
    MigroshemenModule,
    MorhipoModule,
    NoonModule,
    OpencartModule,
    OzonModule,
    PrestashopModule,
    RobomarktModule,
    SahibindenModule,
    ShopigoModule,
    TeknosaModule,
    TemuModule,
    TrendyolGoModule,
    UniposModule,
    VatanModule,
    VestelModule,
    WildberriesModule,
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
    A101Module,
    AkinonModule,
    AllegroModule,
    AmazonEuModule,
    ArcelikModule,
    BanabiModule,
    BimakilliModule,
    BoynerModule,
    CdiscountModule,
    DefactoModule,
    DolapModule,
    EbayModule,
    ElektraModule,
    EtsyModule,
    FaprikaModule,
    FloModule,
    GetirModule,
    GratisModule,
    HepsiexpressModule,
    IkasModule,
    KauflandModule,
    KotonModule,
    LcwaikikiModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MigrosModule,
    MigroshemenModule,
    MorhipoModule,
    NoonModule,
    OpencartModule,
    OzonModule,
    PrestashopModule,
    RobomarktModule,
    SahibindenModule,
    ShopigoModule,
    TeknosaModule,
    TemuModule,
    TrendyolGoModule,
    UniposModule,
    VatanModule,
    VestelModule,
    WildberriesModule,
  ],
})
export class AdapterModule {}
