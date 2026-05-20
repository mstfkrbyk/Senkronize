import { Global, Module } from '@nestjs/common';

import { AdaptersCommonModule } from './common/adapters-common.module';
import { AdapterRegistry } from './adapter.registry';
import { EcommerceAdaptersModule } from './ecommerce/ecommerce.module';
import { ErpAdaptersModule } from './erp/erp.module';
import { A101Module } from './a101/a101.module';
import { AboutYouModule } from './about-you/about-you.module';
import { AddaxModule } from './addax/addax.module';
import { AdidasTrModule } from './adidas-tr/adidas-tr.module';
import { AldiModule } from './aldi/aldi.module';
import { AlisverisComModule } from './alisveris-com/alisveris-com.module';
import { AwokModule } from './awok/awok.module';
import { AsosModule } from './asos/asos.module';
import { AlibabaModule } from './alibaba/alibaba.module';
import { AlibabaB2bModule } from './alibaba-b2b/alibaba-b2b.module';
import { AlibabaTrModule } from './alibaba-tr/alibaba-tr.module';
import { AutodsModule } from './autods/autods.module';
import { AutotraderModule } from './autotrader/autotrader.module';
import { AkinonModule } from './akinon/akinon.module';
import { AkulakuModule } from './akulaku/akulaku.module';
import { AmericanasModule } from './americanas/americanas.module';
import { ArcelikModule } from './arcelik/arcelik.module';
import { AracimModule } from './aracim/aracim.module';
import { ArtsyModule } from './artsy/artsy.module';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonAeModule } from './amazon-ae/amazon-ae.module';
import { AmazonEuModule } from './amazon-eu/amazon-eu.module';
import { AmazonGlobalModule } from './amazon-global/amazon-global.module';
import { AllegroModule } from './allegro/allegro.module';
import { BizimHesapErpAdapter } from './erp/bizimhesap-erp.adapter';
import { LogoErpAdapter } from './erp/logo-erp.adapter';
import { ParasutErpAdapter } from './erp/parasut-erp.adapter';
import { BizimMuhasebeModule } from './bizim-muhasebe/bizim-muhasebe.module';
import { BoutiqaatModule } from './boutiqaat/boutiqaat.module';
import { BackmarketModule } from './backmarket/backmarket.module';
import { BanabiModule } from './banabi/banabi.module';
import { BestbuyModule } from './bestbuy/bestbuy.module';
import { BigwModule } from './bigw/bigw.module';
import { BidorbuyModule } from './bidorbuy/bidorbuy.module';
import { BimOnlineModule } from './bim-online/bim-online.module';
import { BimakilliModule } from './bimakilli/bimakilli.module';
import { BolcomModule } from './bolcom/bolcom.module';
import { BonanzaModule } from './bonanza/bonanza.module';
import { BuyukMagazaModule } from './buyuk-magaza/buyuk-magaza.module';
import { BlibliModule } from './blibli/blibli.module';
import { BukalapakModule } from './bukalapak/bukalapak.module';
import { BuldumbuldumModule } from './buldumbuldum/buldumbuldum.module';
import { BoynerModule } from './boyner/boyner.module';
import { CatchAuModule } from './catch-au/catch-au.module';
import { CatawikiModule } from './catawiki/catawiki.module';
import { CentralOnlineModule } from './central-online/central-online.module';
import { CarrefoursaModule } from './carrefoursa/carrefoursa.module';
import { CarrefourMeModule } from './carrefour-me/carrefour-me.module';
import { CarrefourFrModule } from './carrefour-fr/carrefour-fr.module';
import { CasinoFrModule } from './casino-fr/casino-fr.module';
import { CdonModule } from './cdon/cdon.module';
import { CdiscountModule } from './cdiscount/cdiscount.module';
import { CiceksepetiEvModule } from './ciceksepeti-ev/ciceksepeti-ev.module';
import { CeneoModule } from './ceneo/ceneo.module';
import { ChairishModule } from './chairish/chairish.module';
import { CimriModule } from './cimri/cimri.module';
import { CoupangModule } from './coupang/coupang.module';
import { CultBeautyModule } from './cult-beauty/cult-beauty.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoModule } from './defacto/defacto.module';
import { DeliverooModule } from './deliveroo/deliveroo.module';
import { DhgateModule } from './dhgate/dhgate.module';
import { DobaModule } from './doba/doba.module';
import { DopingModule } from './doping/doping.module';
import { DarazModule } from './daraz/daraz.module';
import { DecathlonModule } from './decathlon/decathlon.module';
import { DecathlonTrModule } from './decathlon-tr/decathlon-tr.module';
import { DecluttrModule } from './decluttr/decluttr.module';
import { DepopModule } from './depop/depop.module';
import { DlgamerModule } from './dlgamer/dlgamer.module';
import { DustinModule } from './dustin/dustin.module';
import { DolapModule } from './dolap/dolap.module';
import { DrModule } from './dr/dr.module';
import { EllosModule } from './ellos/ellos.module';
import { Ec21Module } from './ec21/ec21.module';
import { EbayModule } from './ebay/ebay.module';
import { EbayMotorsModule } from './ebay-motors/ebay-motors.module';
import { ElektraModule } from './elektra/elektra.module';
import { EmagModule } from './emag/emag.module';
import { EnebaModule } from './eneba/eneba.module';
import { EnparaModule } from './enpara/enpara.module';
import { EtaAdapter } from './eta/eta.adapter';
import { EtsyModule } from './etsy/etsy.module';
import { EvideaModule } from './evidea/evidea.module';
import { ExportifyModule } from './exportify/exportify.module';
import { GlobalSourcesModule } from './global-sources/global-sources.module';
import { FinansMuhasebeModule } from './finans-muhasebe/finans-muhasebe.module';
import { FirstdibsModule } from './firstdibs/firstdibs.module';
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
import { GymsharkModule } from './gymshark/gymshark.module';
import { GotoBusinessModule } from './goto-business/goto-business.module';
import { GmarketModule } from './gmarket/gmarket.module';
import { GrabMartModule } from './grab-mart/grab-mart.module';
import { G2aModule } from './g2a/g2a.module';
import { GameflipModule } from './gameflip/gameflip.module';
import { GittigidiyorModule } from './gittigidiyor/gittigidiyor.module';
import { GratisModule } from './gratis/gratis.module';
import { HellofreshModule } from './hellofresh/hellofresh.module';
import { HeurekaModule } from './heureka/heureka.module';
import { IherbModule } from './iherb/iherb.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumModule } from './hepsiburada-premium/hepsiburada-premium.module';
import { HepsiexpressModule } from './hepsiexpress/hepsiexpress.module';
import { HizliresmiModule } from './hizliresmi/hizliresmi.module';
import { HarveyNormanModule } from './harvey-norman/harvey-norman.module';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IdealoModule } from './idealo/idealo.module';
import { IndiamartModule } from './indiamart/indiamart.module';
import { IdefixModule } from './idefix/idefix.module';
import { InstacartModule } from './instacart/instacart.module';
import { InstagramShopModule } from './instagram-shop/instagram-shop.module';
import { IntersportTrModule } from './intersport-tr/intersport-tr.module';
import { IkasModule } from './ikas/ikas.module';
import { IkasMpModule } from './ikas-mp/ikas-mp.module';
import { IyzicoModule } from './iyzico/iyzico.module';
import { IsnetAdapter } from './isnet/isnet.adapter';
import { JdidModule } from './jdid/jdid.module';
import { JdcomModule } from './jdcom/jdcom.module';
import { JetModule } from './jet/jet.module';
import { JiomartModule } from './jiomart/jiomart.module';
import { JoomModule } from './joom/joom.module';
import { JumiaModule } from './jumia/jumia.module';
import { LamodaModule } from './lamoda/lamoda.module';
import { KauflandModule } from './kaufland/kaufland.module';
import { KaspiModule } from './kaspi/kaspi.module';
import { KomplettModule } from './komplett/komplett.module';
import { KinguinModule } from './kinguin/kinguin.module';
import { KitapyurduModule } from './kitapyurdu/kitapyurdu.module';
import { KmartAuModule } from './kmart-au/kmart-au.module';
import { KilimallModule } from './kilimall/kilimall.module';
import { KoctasModule } from './koctas/koctas.module';
import { KolaybiAdapter } from './kolaybi/kolaybi.adapter';
import { KongaModule } from './konga/konga.module';
import { KotonModule } from './koton/koton.module';
import { LazadaModule } from './lazada/lazada.module';
import { LazadaPhModule } from './lazada-ph/lazada-ph.module';
import { LaredouteModule } from './laredoute/laredoute.module';
import { LcwaikikiModule } from './lcwaikiki/lcwaikiki.module';
import { LookfantasticModule } from './lookfantastic/lookfantastic.module';
import { LetgoModule } from './letgo/letgo.module';
import { LidyanaModule } from './lidyana/lidyana.module';
import { LidlModule } from './lidl/lidl.module';
import { LinioModule } from './linio/linio.module';
import { LogoCommerceModule } from './logo-commerce/logo-commerce.module';
import { LogoCloudModule } from './logo-cloud/logo-cloud.module';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeinchinaModule } from './madeinchina/madeinchina.module';
import { MagaluModule } from './magalu/magalu.module';
import { MallCzModule } from './mall-cz/mall-cz.module';
import { MagentoModule } from './magento/magento.module';
import { MedusaModule } from './medusa/medusa.module';
import { ManomanoModule } from './manomano/manomano.module';
import { MaviModule } from './mavi/mavi.module';
import { MediamarktModule } from './mediamarkt/mediamarkt.module';
import { MediamarktTrModule } from './mediamarkt-tr/mediamarkt-tr.module';
import { MeeshoModule } from './meesho/meesho.module';
import { MercadolibreModule } from './mercadolibre/mercadolibre.module';
import { MercariModule } from './mercari/mercari.module';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MikroBulutModule } from './mikro-bulut/mikro-bulut.module';
import { MigrosModule } from './migros/migros.module';
import { MigrosHizliModule } from './migros-hizli/migros-hizli.module';
import { MigrosSanalModule } from './migros-sanal/migros-sanal.module';
import { MydealModule } from './mydeal/mydeal.module';
import { MigroshemenModule } from './migroshemen/migroshemen.module';
import { MiintoModule } from './miinto/miinto.module';
import { MumzworldModule } from './mumzworld/mumzworld.module';
import { ModacruzModule } from './modacruz/modacruz.module';
import { ModanisaModule } from './modanisa/modanisa.module';
import { MorhipoModule } from './morhipo/morhipo.module';
import { MysoftModule } from './mysoft/mysoft.module';
import { MyntraModule } from './myntra/myntra.module';
import { N11Adapter } from './n11/n11.adapter';
import { N11ProModule } from './n11-pro/n11-pro.module';
import { NotinoModule } from './notino/notino.module';
import { NamshiModule } from './namshi/namshi.module';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NebimAdapter } from './nebim/nebim.adapter';
import { NoonModule } from './noon/noon.module';
import { NoonSaModule } from './noon-sa/noon-sa.module';
import { NeweggModule } from './newegg/newegg.module';
import { OnbuyModule } from './onbuy/onbuy.module';
import { OttoModule } from './otto/otto.module';
import { OtoplazaModule } from './otoplaza/otoplaza.module';
import { OunassModule } from './ounass/ounass.module';
import { OpencartModule } from './opencart/opencart.module';
import { OlxModule } from './olx/olx.module';
import { OpensooqModule } from './opensooq/opensooq.module';
import { OverstockModule } from './overstock/overstock.module';
import { OzonModule } from './ozon/ozon.module';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumModule } from './pazarama-premium/pazarama-premium.module';
import { Pazar365Module } from './pazar365/pazar365.module';
import { PowerDkModule } from './power-dk/power-dk.module';
import { PorlandModule } from './porland/porland.module';
import { PoshmarkModule } from './poshmark/poshmark.module';
import { PiguModule } from './pigu/pigu.module';
import { PrestashopModule } from './prestashop/prestashop.module';
import { PricerunnerModule } from './pricerunner/pricerunner.module';
import { PinterestModule } from './pinterest/pinterest.module';
import { PinktrottersModule } from './pinktrotters/pinktrotters.module';
import { SaleorModule } from './saleor/saleor.module';
import { ProtelModule } from './protel/protel.module';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { Qoo10Module } from './qoo10/qoo10.module';
import { RakutenModule } from './rakuten/rakuten.module';
import { RealdeModule } from './realde/realde.module';
import { ReverbModule } from './reverb/reverb.module';
import { RobomarktModule } from './robomarkt/robomarkt.module';
import { RossmannTrModule } from './rossmann-tr/rossmann-tr.module';
import { SahibindenPremiumModule } from './sahibinden-premium/sahibinden-premium.module';
import { SendoModule } from './sendo/sendo.module';
import { SheinModule } from './shein/shein.module';
import { SivviModule } from './sivvi/sivvi.module';
import { SharafDgModule } from './sharaf-dg/sharaf-dg.module';
import { OberloModule } from './oberlo/oberlo.module';
import { SahibindenB2bModule } from './sahibinden-b2b/sahibinden-b2b.module';
import { SahibindenProModule } from './sahibinden-pro/sahibinden-pro.module';
import { SpocketModule } from './spocket/spocket.module';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SefamerveModule } from './sefamerve/sefamerve.module';
import { ShopeeModule } from './shopee/shopee.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopirollModule } from './shopiroll/shopiroll.module';
import { ShopiverseModule } from './shopiverse/shopiverse.module';
import { ShopigoModule } from './shopigo/shopigo.module';
import { ShopbackModule } from './shopback/shopback.module';
import { SimpraModule } from './simpra/simpra.module';
import { SokMarketModule } from './sok-market/sok-market.module';
import { SnapdealModule } from './snapdeal/snapdeal.module';
import { SnapchatStoreModule } from './snapchat-store/snapchat-store.module';
import { SouqModule } from './souq/souq.module';
import { SportiveModule } from './sportive/sportive.module';
import { SportiveTrModule } from './sportive-tr/sportive-tr.module';
import { StockxModule } from './stockx/stockx.module';
import { SwappaModule } from './swappa/swappa.module';
import { Street11Module } from './street11/street11.module';
import { TakealotModule } from './takealot/takealot.module';
import { TikiModule } from './tiki/tiki.module';
import { ThredupModule } from './thredup/thredup.module';
import { TiktokShopModule } from './tiktok-shop/tiktok-shop.module';
import { TikladoModule } from './tiklado/tiklado.module';
import { TrademeModule } from './trademe/trademe.module';
import { TradesyModule } from './tradesy/tradesy.module';
import { StripeModule } from './stripe/stripe.module';
import { SpartooModule } from './spartoo/spartoo.module';
import { TedarikciModule } from './tedarikci/tedarikci.module';
import { TeknosaModule } from './teknosa/teknosa.module';
import { ToptaneviModule } from './toptanevi/toptanevi.module';
import { TradeindiaModule } from './tradeindia/tradeindia.module';
import { TemuModule } from './temu/temu.module';
import { TrendyolGoModule } from './trendyol-go/trendyol-go.module';
import { TrendyolGroceriesModule } from './trendyol-groceries/trendyol-groceries.module';
import { TrendyolMillaModule } from './trendyol-milla/trendyol-milla.module';
import { TrendyolIntModule } from './trendyol-int/trendyol-int.module';
import { TrendyolPremiumModule } from './trendyol-premium/trendyol-premium.module';
import { TrendyolSecondHandModule } from './trendyol-second-hand/trendyol-second-hand.module';
import { TrendyolYemekModule } from './trendyol-yemek/trendyol-yemek.module';
import { TazeDirektModule } from './taze-direkt/taze-direkt.module';
import { TargetPlusModule } from './target-plus/target-plus.module';
import { TicimaxErpAdapter } from './erp/ticimax-erp.adapter';
import { TsoftErpAdapter } from './erp/tsoft-erp.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TicimaxMpModule } from './ticimax-mp/ticimax-mp.module';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { TokopediaModule } from './tokopedia/tokopedia.module';
import { UniposModule } from './unipos/unipos.module';
import { UberEatsModule } from './uber-eats/uber-eats.module';
import { UzumModule } from './uzum/uzum.module';
import { VitacostModule } from './vitacost/vitacost.module';
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
import { WhatsappCommerceModule } from './whatsapp-commerce/whatsapp-commerce.module';
import { WayfairModule } from './wayfair/wayfair.module';
import { WebmotorsModule } from './webmotors/webmotors.module';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';
import { YargiciModule } from './yargici/yargici.module';
import { YoutubeShopModule } from './youtube-shop/youtube-shop.module';
import { YemeksepetiModule } from './yemeksepeti/yemeksepeti.module';
import { ZalandoModule } from './zalando/zalando.module';
import { YandexMarketModule } from './yandex-market/yandex-market.module';
import { ZaraModule } from './zara/zara.module';
import { ZaraTrModule } from './zara-tr/zara-tr.module';
import { ZirveAdapter } from './zirve/zirve.adapter';

@Global()
@Module({
  imports: [
    AdaptersCommonModule,
    ErpAdaptersModule,
    EcommerceAdaptersModule,
    A101Module,
    AboutYouModule,
    AddaxModule,
    AdidasTrModule,
    AldiModule,
    AlisverisComModule,
    AwokModule,
    BoutiqaatModule,
    CdonModule,
    CeneoModule,
    ChairishModule,
    DustinModule,
    EllosModule,
    HellofreshModule,
    HeurekaModule,
    IherbModule,
    KomplettModule,
    MumzworldModule,
    OlxModule,
    PowerDkModule,
    AsosModule,
    AlibabaModule,
    AlibabaB2bModule,
    AlibabaTrModule,
    AutodsModule,
    AutotraderModule,
    AkinonModule,
    AkulakuModule,
    AmericanasModule,
    AllegroModule,
    AmazonAeModule,
    AmazonEuModule,
    AmazonGlobalModule,
    ArcelikModule,
    AracimModule,
    ArtsyModule,
    BackmarketModule,
    BanabiModule,
    BestbuyModule,
    BigwModule,
    BidorbuyModule,
    BizimMuhasebeModule,
    BimakilliModule,
    BimOnlineModule,
    BolcomModule,
    BonanzaModule,
    BuyukMagazaModule,
    BlibliModule,
    BukalapakModule,
    BuldumbuldumModule,
    BoynerModule,
    CatchAuModule,
    CatawikiModule,
    CentralOnlineModule,
    CarrefourMeModule,
    CarrefourFrModule,
    CasinoFrModule,
    CarrefoursaModule,
    CdiscountModule,
    CiceksepetiEvModule,
    CimriModule,
    CoupangModule,
    CultBeautyModule,
    DefactoModule,
    DeliverooModule,
    DopingModule,
    DarazModule,
    DecathlonModule,
    DecathlonTrModule,
    DecluttrModule,
    DepopModule,
    DlgamerModule,
    DhgateModule,
    DobaModule,
    Ec21Module,
    DolapModule,
    DrModule,
    EbayModule,
    EbayMotorsModule,
    ElektraModule,
    EmagModule,
    EnebaModule,
    EnparaModule,
    EtsyModule,
    EvideaModule,
    ExportifyModule,
    GlobalSourcesModule,
    FinansMuhasebeModule,
    FirstdibsModule,
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
    G2aModule,
    GameflipModule,
    GittigidiyorModule,
    GorillasModule,
    GymsharkModule,
    GotoBusinessModule,
    GmarketModule,
    GrabMartModule,
    GratisModule,
    HepsiburadaPremiumModule,
    HepsiexpressModule,
    HellofreshModule,
    HizliresmiModule,
    HarveyNormanModule,
    IherbModule,
    IdealoModule,
    IndiamartModule,
    IdefixModule,
    OberloModule,
    IntersportTrModule,
    IkasModule,
    IkasMpModule,
    IyzicoModule,
    InstacartModule,
    InstagramShopModule,
    JdidModule,
    JdcomModule,
    JetModule,
    JiomartModule,
    JoomModule,
    JumiaModule,
    LamodaModule,
    KauflandModule,
    KaspiModule,
    KinguinModule,
    KitapyurduModule,
    KmartAuModule,
    KoctasModule,
    KilimallModule,
    KotonModule,
    KongaModule,
    LazadaModule,
    LazadaPhModule,
    LaredouteModule,
    LetgoModule,
    LcwaikikiModule,
    LookfantasticModule,
    LidyanaModule,
    LidlModule,
    LinioModule,
    LogoCommerceModule,
    LogoCloudModule,
    MadeinchinaModule,
    MagaluModule,
    MallCzModule,
    MagentoModule,
    MedusaModule,
    ManomanoModule,
    MaviModule,
    MediamarktModule,
    MediamarktTrModule,
    MeeshoModule,
    MercadolibreModule,
    MercariModule,
    MikroBulutModule,
    MigrosModule,
    MigroshemenModule,
    MigrosHizliModule,
    MiintoModule,
    MigrosSanalModule,
    ModacruzModule,
    ModanisaModule,
    MorhipoModule,
    MysoftModule,
    MydealModule,
    MyntraModule,
    N11ProModule,
    NotinoModule,
    NamshiModule,
    NoonModule,
    NoonSaModule,
    NeweggModule,
    OnbuyModule,
    OpencartModule,
    OverstockModule,
    OttoModule,
    OtoplazaModule,
    OunassModule,
    OpensooqModule,
    OzonModule,
    PazaramaPremiumModule,
    Pazar365Module,
    PorlandModule,
    PoshmarkModule,
    PiguModule,
    PrestashopModule,
    PricerunnerModule,
    PinterestModule,
    PinktrottersModule,
    SaleorModule,
    ProtelModule,
    Qoo10Module,
    RakutenModule,
    RealdeModule,
    ReverbModule,
    RobomarktModule,
    RossmannTrModule,
    SahibindenModule,
    SahibindenB2bModule,
    SahibindenProModule,
    SpocketModule,
    SahibindenPremiumModule,
    SendoModule,
    SheinModule,
    SivviModule,
    SharafDgModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    ShopbackModule,
    ShopirollModule,
    ShopiverseModule,
    SimpraModule,
    SnapdealModule,
    SnapchatStoreModule,
    SokMarketModule,
    SportiveModule,
    SportiveTrModule,
    StockxModule,
    SwappaModule,
    Street11Module,
    SouqModule,
    TikiModule,
    ThredupModule,
    TiktokShopModule,
    TikladoModule,
    TicimaxMpModule,
    TrademeModule,
    TradesyModule,
    StripeModule,
    SpartooModule,
    TedarikciModule,
    TeknosaModule,
    ToptaneviModule,
    TradeindiaModule,
    TemuModule,
    TargetPlusModule,
    TazeDirektModule,
    TakealotModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolGroceriesModule,
    TrendyolIntModule,
    TrendyolMillaModule,
    TrendyolSecondHandModule,
    TrendyolPremiumModule,
    TrendyolYemekModule,
    UniposModule,
    UberEatsModule,
    UzumModule,
    VitacostModule,
    VatanModule,
    VendureModule,
    VeepeeModule,
    VestelModule,
    VintedModule,
    VivenseModule,
    WatsonsTrModule,
    WhatsappCommerceModule,
    WildberriesModule,
    WishModule,
    WalmartModule,
    WadiModule,
    WayfairModule,
    WebmotorsModule,
    YargiciModule,
    YoutubeShopModule,
    YemeksepetiModule,
    YandexMarketModule,
    ZalandoModule,
    ZaraModule,
    ZaraTrModule,
  ],
  providers: [
    AmazonAdapter,
    TrendyolAdapter,
    HepsiburadaAdapter,
    N11Adapter,
    CiceksepetiAdapter,
    IdeasoftAdapter,
    BizimHesapErpAdapter,
    ParasutErpAdapter,
    LogoErpAdapter,
    MikroAdapter,
    LucaAdapter,
    TsoftAdapter,
    TsoftErpAdapter,
    TicimaxAdapter,
    TicimaxErpAdapter,
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
    BizimHesapErpAdapter,
    ParasutErpAdapter,
    LogoErpAdapter,
    MikroAdapter,
    LucaAdapter,
    TsoftAdapter,
    TsoftErpAdapter,
    TicimaxAdapter,
    TicimaxErpAdapter,
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
    AdidasTrModule,
    AldiModule,
    AlisverisComModule,
    AsosModule,
    AlibabaModule,
    AlibabaB2bModule,
    AlibabaTrModule,
    AutodsModule,
    AutotraderModule,
    AkinonModule,
    AkulakuModule,
    AmericanasModule,
    AllegroModule,
    AmazonAeModule,
    AmazonEuModule,
    AmazonGlobalModule,
    ArcelikModule,
    AracimModule,
    ArtsyModule,
    BackmarketModule,
    BanabiModule,
    BestbuyModule,
    BigwModule,
    BidorbuyModule,
    BizimMuhasebeModule,
    BimakilliModule,
    BimOnlineModule,
    BolcomModule,
    BonanzaModule,
    BuyukMagazaModule,
    BlibliModule,
    BukalapakModule,
    BuldumbuldumModule,
    BoynerModule,
    CatchAuModule,
    CatawikiModule,
    CentralOnlineModule,
    CarrefourMeModule,
    CarrefourFrModule,
    CasinoFrModule,
    CarrefoursaModule,
    CdiscountModule,
    CiceksepetiEvModule,
    CimriModule,
    CoupangModule,
    CultBeautyModule,
    DefactoModule,
    DeliverooModule,
    DopingModule,
    DarazModule,
    DecathlonModule,
    DecathlonTrModule,
    DecluttrModule,
    DepopModule,
    DlgamerModule,
    DhgateModule,
    DobaModule,
    Ec21Module,
    DolapModule,
    DrModule,
    EbayModule,
    EbayMotorsModule,
    ElektraModule,
    EmagModule,
    EnebaModule,
    EnparaModule,
    EtsyModule,
    EvideaModule,
    ExportifyModule,
    GlobalSourcesModule,
    FinansMuhasebeModule,
    FirstdibsModule,
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
    G2aModule,
    GameflipModule,
    GittigidiyorModule,
    GorillasModule,
    GymsharkModule,
    GotoBusinessModule,
    GmarketModule,
    GrabMartModule,
    GratisModule,
    HepsiburadaPremiumModule,
    HepsiexpressModule,
    HellofreshModule,
    HizliresmiModule,
    HarveyNormanModule,
    IherbModule,
    IdealoModule,
    IndiamartModule,
    IdefixModule,
    OberloModule,
    IntersportTrModule,
    IkasModule,
    IkasMpModule,
    IyzicoModule,
    InstacartModule,
    InstagramShopModule,
    JdidModule,
    JdcomModule,
    JetModule,
    JiomartModule,
    JoomModule,
    JumiaModule,
    LamodaModule,
    KauflandModule,
    KaspiModule,
    KinguinModule,
    KitapyurduModule,
    KmartAuModule,
    KoctasModule,
    KilimallModule,
    KotonModule,
    KongaModule,
    LazadaModule,
    LazadaPhModule,
    LaredouteModule,
    LetgoModule,
    LcwaikikiModule,
    LookfantasticModule,
    LidyanaModule,
    LidlModule,
    LinioModule,
    LogoCommerceModule,
    LogoCloudModule,
    MadeinchinaModule,
    MagaluModule,
    MallCzModule,
    MagentoModule,
    MedusaModule,
    ManomanoModule,
    MaviModule,
    MediamarktModule,
    MediamarktTrModule,
    MeeshoModule,
    MercadolibreModule,
    MercariModule,
    MikroBulutModule,
    MigrosModule,
    MigroshemenModule,
    MigrosHizliModule,
    MiintoModule,
    MigrosSanalModule,
    ModacruzModule,
    ModanisaModule,
    MorhipoModule,
    MysoftModule,
    MydealModule,
    MyntraModule,
    N11ProModule,
    NotinoModule,
    NamshiModule,
    NoonModule,
    NoonSaModule,
    NeweggModule,
    OnbuyModule,
    OpencartModule,
    OverstockModule,
    OttoModule,
    OtoplazaModule,
    OunassModule,
    OpensooqModule,
    OzonModule,
    PazaramaPremiumModule,
    Pazar365Module,
    PorlandModule,
    PoshmarkModule,
    PiguModule,
    PrestashopModule,
    PricerunnerModule,
    PinterestModule,
    PinktrottersModule,
    SaleorModule,
    ProtelModule,
    Qoo10Module,
    RakutenModule,
    RealdeModule,
    ReverbModule,
    RobomarktModule,
    RossmannTrModule,
    SahibindenModule,
    SahibindenB2bModule,
    SahibindenProModule,
    SpocketModule,
    SahibindenPremiumModule,
    SendoModule,
    SheinModule,
    SivviModule,
    SharafDgModule,
    SefamerveModule,
    ShopeeModule,
    ShopigoModule,
    ShopbackModule,
    ShopirollModule,
    ShopiverseModule,
    SimpraModule,
    SnapdealModule,
    SnapchatStoreModule,
    SokMarketModule,
    SportiveModule,
    SportiveTrModule,
    StockxModule,
    SwappaModule,
    Street11Module,
    SouqModule,
    TikiModule,
    ThredupModule,
    TiktokShopModule,
    TikladoModule,
    TicimaxMpModule,
    TrademeModule,
    TradesyModule,
    StripeModule,
    SpartooModule,
    TedarikciModule,
    TeknosaModule,
    ToptaneviModule,
    TradeindiaModule,
    TemuModule,
    TargetPlusModule,
    TazeDirektModule,
    TakealotModule,
    TokopediaModule,
    TrendyolGoModule,
    TrendyolGroceriesModule,
    TrendyolIntModule,
    TrendyolMillaModule,
    TrendyolSecondHandModule,
    TrendyolPremiumModule,
    TrendyolYemekModule,
    UniposModule,
    UberEatsModule,
    UzumModule,
    VitacostModule,
    VatanModule,
    VendureModule,
    VeepeeModule,
    VestelModule,
    VintedModule,
    VivenseModule,
    WatsonsTrModule,
    WhatsappCommerceModule,
    WildberriesModule,
    WishModule,
    WalmartModule,
    WadiModule,
    WayfairModule,
    WebmotorsModule,
    YargiciModule,
    YoutubeShopModule,
    YemeksepetiModule,
    ZalandoModule,
    ZaraModule,
    ZaraTrModule,
  ],
})
export class AdapterModule {}
