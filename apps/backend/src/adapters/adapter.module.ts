import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { A101Module } from './a101/a101.module';
import { AddaxModule } from './addax/addax.module';
import { AlibabaModule } from './alibaba/alibaba.module';
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
import { CiceksepetiEvModule } from './ciceksepeti-ev/ciceksepeti-ev.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoModule } from './defacto/defacto.module';
import { DolapModule } from './dolap/dolap.module';
import { DrModule } from './dr/dr.module';
import { EbayModule } from './ebay/ebay.module';
import { ElektraModule } from './elektra/elektra.module';
import { EnparaModule } from './enpara/enpara.module';
import { EtsyModule } from './etsy/etsy.module';
import { EvideaModule } from './evidea/evidea.module';
import { ExportifyModule } from './exportify/exportify.module';
import { FaprikaModule } from './faprika/faprika.module';
import { FloModule } from './flo/flo.module';
import { FuudyModule } from './fuudy/fuudy.module';
import { GetirFoodModule } from './getir-food/getir-food.module';
import { GetirModule } from './getir/getir.module';
import { GittigidiyorModule } from './gittigidiyor/gittigidiyor.module';
import { GratisModule } from './gratis/gratis.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiexpressModule } from './hepsiexpress/hepsiexpress.module';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IkasModule } from './ikas/ikas.module';
import { KauflandModule } from './kaufland/kaufland.module';
import { KitapyurduModule } from './kitapyurdu/kitapyurdu.module';
import { KotonModule } from './koton/koton.module';
import { LazadaModule } from './lazada/lazada.module';
import { LcwaikikiModule } from './lcwaikiki/lcwaikiki.module';
import { LidyanaModule } from './lidyana/lidyana.module';
import { LogoAdapter } from './logo/logo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeinchinaModule } from './madeinchina/madeinchina.module';
import { MagentoModule } from './magento/magento.module';
import { MaviModule } from './mavi/mavi.module';
import { MediamarktModule } from './mediamarkt/mediamarkt.module';
import { MeeshoModule } from './meesho/meesho.module';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MigrosModule } from './migros/migros.module';
import { MigroshemenModule } from './migroshemen/migroshemen.module';
import { ModanisaModule } from './modanisa/modanisa.module';
import { MorhipoModule } from './morhipo/morhipo.module';
import { N11Adapter } from './n11/n11.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NoonModule } from './noon/noon.module';
import { OpencartModule } from './opencart/opencart.module';
import { OzonModule } from './ozon/ozon.module';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PorlandModule } from './porland/porland.module';
import { PrestashopModule } from './prestashop/prestashop.module';
import { RobomarktModule } from './robomarkt/robomarkt.module';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { SefamerveModule } from './sefamerve/sefamerve.module';
import { ShopeeModule } from './shopee/shopee.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopigoModule } from './shopigo/shopigo.module';
import { SportiveModule } from './sportive/sportive.module';
import { TeknosaModule } from './teknosa/teknosa.module';
import { TemuModule } from './temu/temu.module';
import { TrendyolGoModule } from './trendyol-go/trendyol-go.module';
import { TrendyolYemekModule } from './trendyol-yemek/trendyol-yemek.module';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { TokopediaModule } from './tokopedia/tokopedia.module';
import { UniposModule } from './unipos/unipos.module';
import { VatanModule } from './vatan/vatan.module';
import { VestelModule } from './vestel/vestel.module';
import { VivenseModule } from './vivense/vivense.module';
import { WildberriesModule } from './wildberries/wildberries.module';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';
import { YemeksepetiModule } from './yemeksepeti/yemeksepeti.module';

@Global()
@Module({
  imports: [
    A101Module,
    AddaxModule,
    AlibabaModule,
    AkinonModule,
    AllegroModule,
    AmazonEuModule,
    ArcelikModule,
    BanabiModule,
    BimakilliModule,
    BoynerModule,
    CdiscountModule,
    CiceksepetiEvModule,
    DefactoModule,
    DolapModule,
    DrModule,
    EbayModule,
    ElektraModule,
    EnparaModule,
    EtsyModule,
    EvideaModule,
    ExportifyModule,
    FaprikaModule,
    FloModule,
    FuudyModule,
    GetirModule,
    GetirFoodModule,
    GittigidiyorModule,
    GratisModule,
    HepsiexpressModule,
    IkasModule,
    KauflandModule,
    KitapyurduModule,
    KotonModule,
    LazadaModule,
    LcwaikikiModule,
    LidyanaModule,
    MadeinchinaModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MeeshoModule,
    MigrosModule,
    MigroshemenModule,
    ModanisaModule,
    MorhipoModule,
    NoonModule,
    OpencartModule,
    OzonModule,
    PorlandModule,
    PrestashopModule,
    RobomarktModule,
    SahibindenModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    SportiveModule,
    TeknosaModule,
    TemuModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolYemekModule,
    UniposModule,
    VatanModule,
    VestelModule,
    VivenseModule,
    WildberriesModule,
    YemeksepetiModule,
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
    AddaxModule,
    AlibabaModule,
    AkinonModule,
    AllegroModule,
    AmazonEuModule,
    ArcelikModule,
    BanabiModule,
    BimakilliModule,
    BoynerModule,
    CdiscountModule,
    CiceksepetiEvModule,
    DefactoModule,
    DolapModule,
    DrModule,
    EbayModule,
    ElektraModule,
    EnparaModule,
    EtsyModule,
    EvideaModule,
    ExportifyModule,
    FaprikaModule,
    FloModule,
    FuudyModule,
    GetirModule,
    GetirFoodModule,
    GittigidiyorModule,
    GratisModule,
    HepsiexpressModule,
    IkasModule,
    KauflandModule,
    KitapyurduModule,
    KotonModule,
    LazadaModule,
    LcwaikikiModule,
    LidyanaModule,
    MadeinchinaModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MeeshoModule,
    MigrosModule,
    MigroshemenModule,
    ModanisaModule,
    MorhipoModule,
    NoonModule,
    OpencartModule,
    OzonModule,
    PorlandModule,
    PrestashopModule,
    RobomarktModule,
    SahibindenModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    SportiveModule,
    TeknosaModule,
    TemuModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolYemekModule,
    UniposModule,
    VatanModule,
    VestelModule,
    VivenseModule,
    WildberriesModule,
    YemeksepetiModule,
  ],
})
export class AdapterModule {}
