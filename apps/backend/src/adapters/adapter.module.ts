import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { A101Module } from './a101/a101.module';
import { AddaxModule } from './addax/addax.module';
import { AlibabaModule } from './alibaba/alibaba.module';
import { AkinonModule } from './akinon/akinon.module';
import { ArcelikModule } from './arcelik/arcelik.module';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonAeModule } from './amazon-ae/amazon-ae.module';
import { AmazonEuModule } from './amazon-eu/amazon-eu.module';
import { AllegroModule } from './allegro/allegro.module';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BanabiModule } from './banabi/banabi.module';
import { BimakilliModule } from './bimakilli/bimakilli.module';
import { BolcomModule } from './bolcom/bolcom.module';
import { BoynerModule } from './boyner/boyner.module';
import { CarrefourMeModule } from './carrefour-me/carrefour-me.module';
import { CdiscountModule } from './cdiscount/cdiscount.module';
import { CiceksepetiEvModule } from './ciceksepeti-ev/ciceksepeti-ev.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoModule } from './defacto/defacto.module';
import { DarazModule } from './daraz/daraz.module';
import { DecathlonModule } from './decathlon/decathlon.module';
import { DolapModule } from './dolap/dolap.module';
import { DrModule } from './dr/dr.module';
import { EbayModule } from './ebay/ebay.module';
import { ElektraModule } from './elektra/elektra.module';
import { EmagModule } from './emag/emag.module';
import { EnparaModule } from './enpara/enpara.module';
import { EtaAdapter } from './eta/eta.adapter';
import { EtsyModule } from './etsy/etsy.module';
import { EvideaModule } from './evidea/evidea.module';
import { ExportifyModule } from './exportify/exportify.module';
import { FlipkartModule } from './flipkart/flipkart.module';
import { FaprikaModule } from './faprika/faprika.module';
import { FloModule } from './flo/flo.module';
import { FuudyModule } from './fuudy/fuudy.module';
import { GetirFoodModule } from './getir-food/getir-food.module';
import { GetirYemekModule } from './getir-yemek/getir-yemek.module';
import { GetirModule } from './getir/getir.module';
import { GittigidiyorModule } from './gittigidiyor/gittigidiyor.module';
import { GratisModule } from './gratis/gratis.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumModule } from './hepsiburada-premium/hepsiburada-premium.module';
import { HepsiexpressModule } from './hepsiexpress/hepsiexpress.module';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IdealoModule } from './idealo/idealo.module';
import { IkasModule } from './ikas/ikas.module';
import { IsnetAdapter } from './isnet/isnet.adapter';
import { JumiaModule } from './jumia/jumia.module';
import { KauflandModule } from './kaufland/kaufland.module';
import { KitapyurduModule } from './kitapyurdu/kitapyurdu.module';
import { KolaybiAdapter } from './kolaybi/kolaybi.adapter';
import { KotonModule } from './koton/koton.module';
import { LazadaModule } from './lazada/lazada.module';
import { LazadaPhModule } from './lazada-ph/lazada-ph.module';
import { LcwaikikiModule } from './lcwaikiki/lcwaikiki.module';
import { LetgoModule } from './letgo/letgo.module';
import { LidyanaModule } from './lidyana/lidyana.module';
import { LogoCommerceModule } from './logo-commerce/logo-commerce.module';
import { LogoAdapter } from './logo/logo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeinchinaModule } from './madeinchina/madeinchina.module';
import { MagentoModule } from './magento/magento.module';
import { MaviModule } from './mavi/mavi.module';
import { MediamarktModule } from './mediamarkt/mediamarkt.module';
import { MeeshoModule } from './meesho/meesho.module';
import { MercadolibreModule } from './mercadolibre/mercadolibre.module';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MigrosModule } from './migros/migros.module';
import { MigroshemenModule } from './migroshemen/migroshemen.module';
import { ModanisaModule } from './modanisa/modanisa.module';
import { MorhipoModule } from './morhipo/morhipo.module';
import { MysoftModule } from './mysoft/mysoft.module';
import { MyntraModule } from './myntra/myntra.module';
import { N11Adapter } from './n11/n11.adapter';
import { N11ProModule } from './n11-pro/n11-pro.module';
import { NamshiModule } from './namshi/namshi.module';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NebimAdapter } from './nebim/nebim.adapter';
import { NoonModule } from './noon/noon.module';
import { OttoModule } from './otto/otto.module';
import { OpencartModule } from './opencart/opencart.module';
import { OzonModule } from './ozon/ozon.module';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumModule } from './pazarama-premium/pazarama-premium.module';
import { PorlandModule } from './porland/porland.module';
import { PrestashopModule } from './prestashop/prestashop.module';
import { ProtelModule } from './protel/protel.module';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { Qoo10Module } from './qoo10/qoo10.module';
import { RakutenModule } from './rakuten/rakuten.module';
import { RealdeModule } from './realde/realde.module';
import { RobomarktModule } from './robomarkt/robomarkt.module';
import { SahibindenProModule } from './sahibinden-pro/sahibinden-pro.module';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SefamerveModule } from './sefamerve/sefamerve.module';
import { ShopeeModule } from './shopee/shopee.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopiverseModule } from './shopiverse/shopiverse.module';
import { ShopigoModule } from './shopigo/shopigo.module';
import { SimpraModule } from './simpra/simpra.module';
import { SnapdealModule } from './snapdeal/snapdeal.module';
import { SportiveModule } from './sportive/sportive.module';
import { TeknosaModule } from './teknosa/teknosa.module';
import { TemuModule } from './temu/temu.module';
import { TrendyolGoModule } from './trendyol-go/trendyol-go.module';
import { TrendyolPremiumModule } from './trendyol-premium/trendyol-premium.module';
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
import { ZalandoModule } from './zalando/zalando.module';
import { ZaraModule } from './zara/zara.module';
import { ZirveAdapter } from './zirve/zirve.adapter';

@Global()
@Module({
  imports: [
    A101Module,
    AddaxModule,
    AlibabaModule,
    AkinonModule,
    AllegroModule,
    AmazonAeModule,
    AmazonEuModule,
    ArcelikModule,
    BanabiModule,
    BimakilliModule,
    BolcomModule,
    BoynerModule,
    CarrefourMeModule,
    CdiscountModule,
    CiceksepetiEvModule,
    DefactoModule,
    DarazModule,
    DecathlonModule,
    DolapModule,
    DrModule,
    EbayModule,
    ElektraModule,
    EmagModule,
    EnparaModule,
    EtsyModule,
    EvideaModule,
    ExportifyModule,
    FlipkartModule,
    FaprikaModule,
    FloModule,
    FuudyModule,
    GetirModule,
    GetirFoodModule,
    GetirYemekModule,
    GittigidiyorModule,
    GratisModule,
    HepsiburadaPremiumModule,
    HepsiexpressModule,
    IdealoModule,
    IkasModule,
    JumiaModule,
    KauflandModule,
    KitapyurduModule,
    KotonModule,
    LazadaModule,
    LazadaPhModule,
    LetgoModule,
    LcwaikikiModule,
    LidyanaModule,
    LogoCommerceModule,
    MadeinchinaModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MeeshoModule,
    MercadolibreModule,
    MigrosModule,
    MigroshemenModule,
    ModanisaModule,
    MorhipoModule,
    MysoftModule,
    MyntraModule,
    N11ProModule,
    NamshiModule,
    NoonModule,
    OpencartModule,
    OttoModule,
    OzonModule,
    PazaramaPremiumModule,
    PorlandModule,
    PrestashopModule,
    ProtelModule,
    Qoo10Module,
    RakutenModule,
    RealdeModule,
    RobomarktModule,
    SahibindenModule,
    SahibindenProModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    ShopiverseModule,
    SimpraModule,
    SnapdealModule,
    SportiveModule,
    TeknosaModule,
    TemuModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolPremiumModule,
    TrendyolYemekModule,
    UniposModule,
    VatanModule,
    VestelModule,
    VivenseModule,
    WildberriesModule,
    YemeksepetiModule,
    ZalandoModule,
    ZaraModule,
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
    EtaAdapter,
    IsnetAdapter,
    KolaybiAdapter,
    NebimAdapter,
    SapB1Adapter,
    ZirveAdapter,
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
    EtaAdapter,
    IsnetAdapter,
    KolaybiAdapter,
    NebimAdapter,
    SapB1Adapter,
    ZirveAdapter,
    A101Module,
    AddaxModule,
    AlibabaModule,
    AkinonModule,
    AllegroModule,
    AmazonAeModule,
    AmazonEuModule,
    ArcelikModule,
    BanabiModule,
    BimakilliModule,
    BolcomModule,
    BoynerModule,
    CarrefourMeModule,
    CdiscountModule,
    CiceksepetiEvModule,
    DefactoModule,
    DarazModule,
    DecathlonModule,
    DolapModule,
    DrModule,
    EbayModule,
    ElektraModule,
    EmagModule,
    EnparaModule,
    EtsyModule,
    EvideaModule,
    ExportifyModule,
    FlipkartModule,
    FaprikaModule,
    FloModule,
    FuudyModule,
    GetirModule,
    GetirFoodModule,
    GetirYemekModule,
    GittigidiyorModule,
    GratisModule,
    HepsiburadaPremiumModule,
    HepsiexpressModule,
    IdealoModule,
    IkasModule,
    JumiaModule,
    KauflandModule,
    KitapyurduModule,
    KotonModule,
    LazadaModule,
    LazadaPhModule,
    LetgoModule,
    LcwaikikiModule,
    LidyanaModule,
    LogoCommerceModule,
    MadeinchinaModule,
    MagentoModule,
    MaviModule,
    MediamarktModule,
    MeeshoModule,
    MercadolibreModule,
    MigrosModule,
    MigroshemenModule,
    ModanisaModule,
    MorhipoModule,
    MysoftModule,
    MyntraModule,
    N11ProModule,
    NamshiModule,
    NoonModule,
    OpencartModule,
    OttoModule,
    OzonModule,
    PazaramaPremiumModule,
    PorlandModule,
    PrestashopModule,
    ProtelModule,
    Qoo10Module,
    RakutenModule,
    RealdeModule,
    RobomarktModule,
    SahibindenModule,
    SahibindenProModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    ShopiverseModule,
    SimpraModule,
    SnapdealModule,
    SportiveModule,
    TeknosaModule,
    TemuModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolPremiumModule,
    TrendyolYemekModule,
    UniposModule,
    VatanModule,
    VestelModule,
    VivenseModule,
    WildberriesModule,
    YemeksepetiModule,
    ZalandoModule,
    ZaraModule,
  ],
})
export class AdapterModule {}
