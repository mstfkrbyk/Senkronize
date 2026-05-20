import { Global, Module } from '@nestjs/common';

import { AdapterRegistry } from './adapter.registry';
import { ErpAdaptersModule } from './erp/erp.module';
import { A101Module } from './a101/a101.module';
import { AboutYouModule } from './about-you/about-you.module';
import { AddaxModule } from './addax/addax.module';
import { AsosModule } from './asos/asos.module';
import { AlibabaModule } from './alibaba/alibaba.module';
import { AlibabaTrModule } from './alibaba-tr/alibaba-tr.module';
import { AkinonModule } from './akinon/akinon.module';
import { AkulakuModule } from './akulaku/akulaku.module';
import { AmericanasModule } from './americanas/americanas.module';
import { ArcelikModule } from './arcelik/arcelik.module';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonAeModule } from './amazon-ae/amazon-ae.module';
import { AmazonEuModule } from './amazon-eu/amazon-eu.module';
import { AmazonGlobalModule } from './amazon-global/amazon-global.module';
import { AllegroModule } from './allegro/allegro.module';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BizimMuhasebeModule } from './bizim-muhasebe/bizim-muhasebe.module';
import { BanabiModule } from './banabi/banabi.module';
import { BestbuyModule } from './bestbuy/bestbuy.module';
import { BidorbuyModule } from './bidorbuy/bidorbuy.module';
import { BimOnlineModule } from './bim-online/bim-online.module';
import { BimakilliModule } from './bimakilli/bimakilli.module';
import { BolcomModule } from './bolcom/bolcom.module';
import { BlibliModule } from './blibli/blibli.module';
import { BukalapakModule } from './bukalapak/bukalapak.module';
import { BoynerModule } from './boyner/boyner.module';
import { CatchAuModule } from './catch-au/catch-au.module';
import { CentralOnlineModule } from './central-online/central-online.module';
import { CarrefoursaModule } from './carrefoursa/carrefoursa.module';
import { CarrefourMeModule } from './carrefour-me/carrefour-me.module';
import { CdiscountModule } from './cdiscount/cdiscount.module';
import { CiceksepetiEvModule } from './ciceksepeti-ev/ciceksepeti-ev.module';
import { CimriModule } from './cimri/cimri.module';
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
import { FinansMuhasebeModule } from './finans-muhasebe/finans-muhasebe.module';
import { FlipkartModule } from './flipkart/flipkart.module';
import { FnacModule } from './fnac/fnac.module';
import { FruugoModule } from './fruugo/fruugo.module';
import { FaprikaModule } from './faprika/faprika.module';
import { FalabellaModule } from './falabella/falabella.module';
import { FloModule } from './flo/flo.module';
import { FuudyModule } from './fuudy/fuudy.module';
import { GetirFoodModule } from './getir-food/getir-food.module';
import { GetirMarketModule } from './getir-market/getir-market.module';
import { GetirYemekModule } from './getir-yemek/getir-yemek.module';
import { GetirModule } from './getir/getir.module';
import { GorillasModule } from './gorillas/gorillas.module';
import { GotoBusinessModule } from './goto-business/goto-business.module';
import { GrabMartModule } from './grab-mart/grab-mart.module';
import { GittigidiyorModule } from './gittigidiyor/gittigidiyor.module';
import { GratisModule } from './gratis/gratis.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumModule } from './hepsiburada-premium/hepsiburada-premium.module';
import { HepsiexpressModule } from './hepsiexpress/hepsiexpress.module';
import { HizliresmiModule } from './hizliresmi/hizliresmi.module';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IdealoModule } from './idealo/idealo.module';
import { InstacartModule } from './instacart/instacart.module';
import { IkasModule } from './ikas/ikas.module';
import { IkasMpModule } from './ikas-mp/ikas-mp.module';
import { IyzicoModule } from './iyzico/iyzico.module';
import { IsnetAdapter } from './isnet/isnet.adapter';
import { JdidModule } from './jdid/jdid.module';
import { JiomartModule } from './jiomart/jiomart.module';
import { JoomModule } from './joom/joom.module';
import { JumiaModule } from './jumia/jumia.module';
import { LamodaModule } from './lamoda/lamoda.module';
import { KauflandModule } from './kaufland/kaufland.module';
import { KaspiModule } from './kaspi/kaspi.module';
import { KitapyurduModule } from './kitapyurdu/kitapyurdu.module';
import { KilimallModule } from './kilimall/kilimall.module';
import { KoctasModule } from './koctas/koctas.module';
import { KolaybiAdapter } from './kolaybi/kolaybi.adapter';
import { KongaModule } from './konga/konga.module';
import { KotonModule } from './koton/koton.module';
import { LazadaModule } from './lazada/lazada.module';
import { LazadaPhModule } from './lazada-ph/lazada-ph.module';
import { LaredouteModule } from './laredoute/laredoute.module';
import { LcwaikikiModule } from './lcwaikiki/lcwaikiki.module';
import { LetgoModule } from './letgo/letgo.module';
import { LidyanaModule } from './lidyana/lidyana.module';
import { LinioModule } from './linio/linio.module';
import { LogoCommerceModule } from './logo-commerce/logo-commerce.module';
import { LogoCloudModule } from './logo-cloud/logo-cloud.module';
import { LogoAdapter } from './logo/logo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeinchinaModule } from './madeinchina/madeinchina.module';
import { MagaluModule } from './magalu/magalu.module';
import { MagentoModule } from './magento/magento.module';
import { MedusaModule } from './medusa/medusa.module';
import { ManomanoModule } from './manomano/manomano.module';
import { MaviModule } from './mavi/mavi.module';
import { MediamarktModule } from './mediamarkt/mediamarkt.module';
import { MediamarktTrModule } from './mediamarkt-tr/mediamarkt-tr.module';
import { MeeshoModule } from './meesho/meesho.module';
import { MercadolibreModule } from './mercadolibre/mercadolibre.module';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MikroBulutModule } from './mikro-bulut/mikro-bulut.module';
import { MigrosModule } from './migros/migros.module';
import { MigrosHizliModule } from './migros-hizli/migros-hizli.module';
import { MigrosSanalModule } from './migros-sanal/migros-sanal.module';
import { MydealModule } from './mydeal/mydeal.module';
import { MigroshemenModule } from './migroshemen/migroshemen.module';
import { MiintoModule } from './miinto/miinto.module';
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
import { NoonSaModule } from './noon-sa/noon-sa.module';
import { OnbuyModule } from './onbuy/onbuy.module';
import { OttoModule } from './otto/otto.module';
import { OpencartModule } from './opencart/opencart.module';
import { OpensooqModule } from './opensooq/opensooq.module';
import { OverstockModule } from './overstock/overstock.module';
import { OzonModule } from './ozon/ozon.module';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumModule } from './pazarama-premium/pazarama-premium.module';
import { PorlandModule } from './porland/porland.module';
import { PrestashopModule } from './prestashop/prestashop.module';
import { SaleorModule } from './saleor/saleor.module';
import { ProtelModule } from './protel/protel.module';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { Qoo10Module } from './qoo10/qoo10.module';
import { RakutenModule } from './rakuten/rakuten.module';
import { RealdeModule } from './realde/realde.module';
import { RobomarktModule } from './robomarkt/robomarkt.module';
import { SahibindenPremiumModule } from './sahibinden-premium/sahibinden-premium.module';
import { SendoModule } from './sendo/sendo.module';
import { SheinModule } from './shein/shein.module';
import { SharafDgModule } from './sharaf-dg/sharaf-dg.module';
import { SahibindenProModule } from './sahibinden-pro/sahibinden-pro.module';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SefamerveModule } from './sefamerve/sefamerve.module';
import { ShopeeModule } from './shopee/shopee.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopirollModule } from './shopiroll/shopiroll.module';
import { ShopiverseModule } from './shopiverse/shopiverse.module';
import { ShopigoModule } from './shopigo/shopigo.module';
import { SimpraModule } from './simpra/simpra.module';
import { SokMarketModule } from './sok-market/sok-market.module';
import { SnapdealModule } from './snapdeal/snapdeal.module';
import { SouqModule } from './souq/souq.module';
import { SportiveModule } from './sportive/sportive.module';
import { TakealotModule } from './takealot/takealot.module';
import { TikiModule } from './tiki/tiki.module';
import { TikladoModule } from './tiklado/tiklado.module';
import { TrademeModule } from './trademe/trademe.module';
import { StripeModule } from './stripe/stripe.module';
import { SpartooModule } from './spartoo/spartoo.module';
import { TeknosaModule } from './teknosa/teknosa.module';
import { TemuModule } from './temu/temu.module';
import { TrendyolGoModule } from './trendyol-go/trendyol-go.module';
import { TrendyolMillaModule } from './trendyol-milla/trendyol-milla.module';
import { TrendyolIntModule } from './trendyol-int/trendyol-int.module';
import { TrendyolPremiumModule } from './trendyol-premium/trendyol-premium.module';
import { TrendyolSecondHandModule } from './trendyol-second-hand/trendyol-second-hand.module';
import { TrendyolYemekModule } from './trendyol-yemek/trendyol-yemek.module';
import { TazeDirektModule } from './taze-direkt/taze-direkt.module';
import { TargetPlusModule } from './target-plus/target-plus.module';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TicimaxMpModule } from './ticimax-mp/ticimax-mp.module';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { TokopediaModule } from './tokopedia/tokopedia.module';
import { UniposModule } from './unipos/unipos.module';
import { UzumModule } from './uzum/uzum.module';
import { VatanModule } from './vatan/vatan.module';
import { VendureModule } from './vendure/vendure.module';
import { VeepeeModule } from './veepee/veepee.module';
import { VestelModule } from './vestel/vestel.module';
import { VintedModule } from './vinted/vinted.module';
import { VivenseModule } from './vivense/vivense.module';
import { WildberriesModule } from './wildberries/wildberries.module';
import { WishModule } from './wish/wish.module';
import { WalmartModule } from './walmart/walmart.module';
import { WadiModule } from './wadi/wadi.module';
import { WatsonsTrModule } from './watsons-tr/watsons-tr.module';
import { WayfairModule } from './wayfair/wayfair.module';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';
import { YemeksepetiModule } from './yemeksepeti/yemeksepeti.module';
import { ZalandoModule } from './zalando/zalando.module';
import { YandexMarketModule } from './yandex-market/yandex-market.module';
import { ZaraModule } from './zara/zara.module';
import { ZirveAdapter } from './zirve/zirve.adapter';

@Global()
@Module({
  imports: [
    ErpAdaptersModule,
    A101Module,
    AboutYouModule,
    AddaxModule,
    AsosModule,
    AlibabaModule,
    AlibabaTrModule,
    AkinonModule,
    AkulakuModule,
    AmericanasModule,
    AllegroModule,
    AmazonAeModule,
    AmazonEuModule,
    AmazonGlobalModule,
    ArcelikModule,
    BanabiModule,
    BestbuyModule,
    BidorbuyModule,
    BizimMuhasebeModule,
    BimakilliModule,
    BimOnlineModule,
    BolcomModule,
    BlibliModule,
    BukalapakModule,
    BoynerModule,
    CatchAuModule,
    CentralOnlineModule,
    CarrefourMeModule,
    CarrefoursaModule,
    CdiscountModule,
    CiceksepetiEvModule,
    CimriModule,
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
    FinansMuhasebeModule,
    FlipkartModule,
    FnacModule,
    FruugoModule,
    FaprikaModule,
    FalabellaModule,
    FloModule,
    FuudyModule,
    GetirModule,
    GetirFoodModule,
    GetirMarketModule,
    GetirYemekModule,
    GittigidiyorModule,
    GorillasModule,
    GotoBusinessModule,
    GrabMartModule,
    GratisModule,
    HepsiburadaPremiumModule,
    HepsiexpressModule,
    HizliresmiModule,
    IdealoModule,
    IkasModule,
    IkasMpModule,
    IyzicoModule,
    InstacartModule,
    JdidModule,
    JiomartModule,
    JoomModule,
    JumiaModule,
    LamodaModule,
    KauflandModule,
    KaspiModule,
    KitapyurduModule,
    KoctasModule,
    KilimallModule,
    KotonModule,
    KongaModule,
    LazadaModule,
    LazadaPhModule,
    LaredouteModule,
    LetgoModule,
    LcwaikikiModule,
    LidyanaModule,
    LinioModule,
    LogoCommerceModule,
    LogoCloudModule,
    MadeinchinaModule,
    MagaluModule,
    MagentoModule,
    MedusaModule,
    ManomanoModule,
    MaviModule,
    MediamarktModule,
    MediamarktTrModule,
    MeeshoModule,
    MercadolibreModule,
    MikroBulutModule,
    MigrosModule,
    MigroshemenModule,
    MigrosHizliModule,
    MiintoModule,
    MigrosSanalModule,
    ModanisaModule,
    MorhipoModule,
    MysoftModule,
    MydealModule,
    MyntraModule,
    N11ProModule,
    NamshiModule,
    NoonModule,
    NoonSaModule,
    OnbuyModule,
    OpencartModule,
    OverstockModule,
    OttoModule,
    OpensooqModule,
    OzonModule,
    PazaramaPremiumModule,
    PorlandModule,
    PrestashopModule,
    SaleorModule,
    ProtelModule,
    Qoo10Module,
    RakutenModule,
    RealdeModule,
    RobomarktModule,
    SahibindenModule,
    SahibindenProModule,
    SahibindenPremiumModule,
    SendoModule,
    SheinModule,
    SharafDgModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    ShopirollModule,
    ShopiverseModule,
    SimpraModule,
    SnapdealModule,
    SokMarketModule,
    SportiveModule,
    SouqModule,
    TikiModule,
    TikladoModule,
    TicimaxMpModule,
    TrademeModule,
    StripeModule,
    SpartooModule,
    TeknosaModule,
    TemuModule,
    TargetPlusModule,
    TazeDirektModule,
    TakealotModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolIntModule,
    TrendyolMillaModule,
    TrendyolSecondHandModule,
    TrendyolPremiumModule,
    TrendyolYemekModule,
    UniposModule,
    UzumModule,
    VatanModule,
    VendureModule,
    VeepeeModule,
    VestelModule,
    VintedModule,
    VivenseModule,
    WatsonsTrModule,
    WildberriesModule,
    WishModule,
    WalmartModule,
    WadiModule,
    WayfairModule,
    YemeksepetiModule,
    YandexMarketModule,
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
    AboutYouModule,
    AddaxModule,
    AsosModule,
    AlibabaModule,
    AlibabaTrModule,
    AkinonModule,
    AkulakuModule,
    AmericanasModule,
    AllegroModule,
    AmazonAeModule,
    AmazonEuModule,
    AmazonGlobalModule,
    ArcelikModule,
    BanabiModule,
    BestbuyModule,
    BidorbuyModule,
    BizimMuhasebeModule,
    BimakilliModule,
    BimOnlineModule,
    BolcomModule,
    BlibliModule,
    BukalapakModule,
    BoynerModule,
    CatchAuModule,
    CentralOnlineModule,
    CarrefourMeModule,
    CarrefoursaModule,
    CdiscountModule,
    CiceksepetiEvModule,
    CimriModule,
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
    FinansMuhasebeModule,
    FlipkartModule,
    FnacModule,
    FruugoModule,
    FaprikaModule,
    FalabellaModule,
    FloModule,
    FuudyModule,
    GetirModule,
    GetirFoodModule,
    GetirMarketModule,
    GetirYemekModule,
    GittigidiyorModule,
    GorillasModule,
    GotoBusinessModule,
    GrabMartModule,
    GratisModule,
    HepsiburadaPremiumModule,
    HepsiexpressModule,
    HizliresmiModule,
    IdealoModule,
    IkasModule,
    IkasMpModule,
    IyzicoModule,
    InstacartModule,
    JdidModule,
    JiomartModule,
    JoomModule,
    JumiaModule,
    LamodaModule,
    KauflandModule,
    KaspiModule,
    KitapyurduModule,
    KoctasModule,
    KilimallModule,
    KotonModule,
    KongaModule,
    LazadaModule,
    LazadaPhModule,
    LaredouteModule,
    LetgoModule,
    LcwaikikiModule,
    LidyanaModule,
    LinioModule,
    LogoCommerceModule,
    LogoCloudModule,
    MadeinchinaModule,
    MagaluModule,
    MagentoModule,
    MedusaModule,
    ManomanoModule,
    MaviModule,
    MediamarktModule,
    MediamarktTrModule,
    MeeshoModule,
    MercadolibreModule,
    MikroBulutModule,
    MigrosModule,
    MigroshemenModule,
    MigrosHizliModule,
    MiintoModule,
    MigrosSanalModule,
    ModanisaModule,
    MorhipoModule,
    MysoftModule,
    MydealModule,
    MyntraModule,
    N11ProModule,
    NamshiModule,
    NoonModule,
    NoonSaModule,
    OnbuyModule,
    OpencartModule,
    OverstockModule,
    OttoModule,
    OpensooqModule,
    OzonModule,
    PazaramaPremiumModule,
    PorlandModule,
    PrestashopModule,
    SaleorModule,
    ProtelModule,
    Qoo10Module,
    RakutenModule,
    RealdeModule,
    RobomarktModule,
    SahibindenModule,
    SahibindenProModule,
    SahibindenPremiumModule,
    SendoModule,
    SheinModule,
    SharafDgModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    ShopirollModule,
    ShopiverseModule,
    SimpraModule,
    SnapdealModule,
    SokMarketModule,
    SportiveModule,
    SouqModule,
    TikiModule,
    TikladoModule,
    TicimaxMpModule,
    TrademeModule,
    StripeModule,
    SpartooModule,
    TeknosaModule,
    TemuModule,
    TargetPlusModule,
    TazeDirektModule,
    TakealotModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolIntModule,
    TrendyolMillaModule,
    TrendyolSecondHandModule,
    TrendyolPremiumModule,
    TrendyolYemekModule,
    UniposModule,
    UzumModule,
    VatanModule,
    VendureModule,
    VeepeeModule,
    VestelModule,
    VintedModule,
    VivenseModule,
    WatsonsTrModule,
    WildberriesModule,
    WishModule,
    WalmartModule,
    WadiModule,
    WayfairModule,
    YemeksepetiModule,
    ZalandoModule,
    ZaraModule,
  ],
})
export class AdapterModule {}
