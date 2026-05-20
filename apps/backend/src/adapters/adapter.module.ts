import { Global, Module } from '@nestjs/common';

import { AdaptersCommonModule } from './common/adapters-common.module';
import { AdapterRegistry } from './adapter.registry';
import { DbaModule } from './dba/dba.module';
import { DeuxiemeMainModule } from './deuxieme-main/deuxieme-main.module';
import { EcommerceAdaptersModule } from './ecommerce/ecommerce.module';
import { AfterpayModule } from './afterpay/afterpay.module';
import { BerealShopModule } from './bereal-shop/bereal-shop.module';
import { Brands4lessModule } from './brands4less/brands4less.module';
import { CloverModule } from './clover/clover.module';
import { FinnNoModule } from './finn-no/finn-no.module';
import { FyndiqModule } from './fyndiq/fyndiq.module';
import { GumroadModule } from './gumroad/gumroad.module';
import { HarajModule } from './haraj/haraj.module';
import { KlarnaMerchantModule } from './klarna-merchant/klarna-merchant.module';
import { OkxTrModule } from './okx-tr/okx-tr.module';
import { OlxPtModule } from './olx-pt/olx-pt.module';
import { PaparaModule } from './papara/papara.module';
import { ParibuModule } from './paribu/paribu.module';
import { PatreonModule } from './patreon/patreon.module';
import { PricespyModule } from './pricespy/pricespy.module';
import { RicardoChModule } from './ricardo-ch/ricardo-ch.module';
import { SquareOnlineModule } from './square-online/square-online.module';
import { ThreadsShopModule } from './threads-shop/threads-shop.module';
import { ToriModule } from './tori/tori.module';
import { ToslaModule } from './tosla/tosla.module';
import { TraderaModule } from './tradera/tradera.module';
import { TuttiChModule } from './tutti-ch/tutti-ch.module';
import { TweakersModule } from './tweakers/tweakers.module';
import { TweeDehandsModule } from './twee-dehands/twee-dehands.module';
import { VendtekModule } from './vendtek/vendtek.module';
import { VenmoBusinessModule } from './venmo-business/venmo-business.module';
import { WillhabenModule } from './willhaben/willhaben.module';
import { XShoppingModule } from './x-shopping/x-shopping.module';
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
import { AliexpressRuModule } from './aliexpress-ru/aliexpress-ru.module';
import { AutodsModule } from './autods/autods.module';
import { AutotraderModule } from './autotrader/autotrader.module';
import { AvitoModule } from './avito/avito.module';
import { AkinonModule } from './akinon/akinon.module';
import { AkulakuModule } from './akulaku/akulaku.module';
import { AmericanasModule } from './americanas/americanas.module';
import { ArcelikModule } from './arcelik/arcelik.module';
import { AracimModule } from './aracim/aracim.module';
import { ArticleModule } from './article/article.module';
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
import { BauhausTrModule } from './bauhaus-tr/bauhaus-tr.module';
import { BanabiModule } from './banabi/banabi.module';
import { BaymioModule } from './baymio/baymio.module';
import { BestbuyModule } from './bestbuy/bestbuy.module';
import { BeymenModule } from './beymen/beymen.module';
import { BigwModule } from './bigw/bigw.module';
import { BirchLaneModule } from './birch-lane/birch-lane.module';
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
import { CepteSokModule } from './cepte-sok/cepte-sok.module';
import { CatchAuModule } from './catch-au/catch-au.module';
import { CatawikiModule } from './catawiki/catawiki.module';
import { CentralOnlineModule } from './central-online/central-online.module';
import { CarrefoursaModule } from './carrefoursa/carrefoursa.module';
import { CarrefourMeModule } from './carrefour-me/carrefour-me.module';
import { CarrefourFrModule } from './carrefour-fr/carrefour-fr.module';
import { CasinoFrModule } from './casino-fr/casino-fr.module';
import { CasasBahiaModule } from './casas-bahia/casas-bahia.module';
import { CdonModule } from './cdon/cdon.module';
import { CdiscountModule } from './cdiscount/cdiscount.module';
import { CiceksepetiEvModule } from './ciceksepeti-ev/ciceksepeti-ev.module';
import { CeneoModule } from './ceneo/ceneo.module';
import { ChairishModule } from './chairish/chairish.module';
import { ChaldalModule } from './chaldal/chaldal.module';
import { CimriModule } from './cimri/cimri.module';
import { ColinsModule } from './colins/colins.module';
import { CoupangModule } from './coupang/coupang.module';
import { CoppelModule } from './coppel/coppel.module';
import { CraftsvillaModule } from './craftsvilla/craftsvilla.module';
import { CostcoCaModule } from './costco-ca/costco-ca.module';
import { CultBeautyModule } from './cult-beauty/cult-beauty.module';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoModule } from './defacto/defacto.module';
import { DeliverooModule } from './deliveroo/deliveroo.module';
import { DhgateModule } from './dhgate/dhgate.module';
import { DobaModule } from './doba/doba.module';
import { DopingModule } from './doping/doping.module';
import { DarazModule } from './daraz/daraz.module';
import { DarazPkModule } from './daraz-pk/daraz-pk.module';
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
import { EnglishHomeModule } from './english-home/english-home.module';
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
import { FaviModule } from './favi/favi.module';
import { FloModule } from './flo/flo.module';
import { FuudyModule } from './fuudy/fuudy.module';
import { GetirFoodModule } from './getir-food/getir-food.module';
import { GetirMarketModule } from './getir-market/getir-market.module';
import { GetirYemekModule } from './getir-yemek/getir-yemek.module';
import { GetirModule } from './getir/getir.module';
import { GorillasModule } from './gorillas/gorillas.module';
import { GymsharkModule } from './gymshark/gymshark.module';
import { GotoBusinessModule } from './goto-business/goto-business.module';
import { GotoLkModule } from './goto-lk/goto-lk.module';
import { GmarketModule } from './gmarket/gmarket.module';
import { GrabMartModule } from './grab-mart/grab-mart.module';
import { GardenaModule } from './gardena/gardena.module';
import { G2aModule } from './g2a/g2a.module';
import { GameflipModule } from './gameflip/gameflip.module';
import { GittigidiyorModule } from './gittigidiyor/gittigidiyor.module';
import { GratisModule } from './gratis/gratis.module';
import { HouzzModule } from './houzz/houzz.module';
import { HellofreshModule } from './hellofresh/hellofresh.module';
import { HeurekaModule } from './heureka/heureka.module';
import { IherbModule } from './iherb/iherb.module';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumModule } from './hepsiburada-premium/hepsiburada-premium.module';
import { HepsiexpressModule } from './hepsiexpress/hepsiexpress.module';
import { HizliresmiModule } from './hizliresmi/hizliresmi.module';
import { HarveyNormanModule } from './harvey-norman/harvey-norman.module';
import { HudsonsBayModule } from './hudsons-bay/hudsons-bay.module';
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
import { JossMainModule } from './joss-main/joss-main.module';
import { JoomModule } from './joom/joom.module';
import { JumiaModule } from './jumia/jumia.module';
import { JuspayModule } from './juspay/juspay.module';
import { KadinClubModule } from './kadin-club/kadin-club.module';
import { LamodaModule } from './lamoda/lamoda.module';
import { KauflandModule } from './kaufland/kaufland.module';
import { KaracaModule } from './karaca/karaca.module';
import { KaspiModule } from './kaspi/kaspi.module';
import { KomplettModule } from './komplett/komplett.module';
import { KupujemProdajemModule } from './kupujem-prodajem/kupujem-prodajem.module';
import { KinguinModule } from './kinguin/kinguin.module';
import { KitapyurduModule } from './kitapyurdu/kitapyurdu.module';
import { KmartAuModule } from './kmart-au/kmart-au.module';
import { KilimallModule } from './kilimall/kilimall.module';
import { KhaadiModule } from './khaadi/khaadi.module';
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
import { LimundoModule } from './limundo/limundo.module';
import { LinensNThingsModule } from './linens-n-things/linens-n-things.module';
import { LinioModule } from './linio/linio.module';
import { LimeroadModule } from './limeroad/limeroad.module';
import { LiverpoolMxModule } from './liverpool-mx/liverpool-mx.module';
import { LogoCommerceModule } from './logo-commerce/logo-commerce.module';
import { LogoCloudModule } from './logo-cloud/logo-cloud.module';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeComModule } from './made-com/made-com.module';
import { MadeinchinaModule } from './madeinchina/madeinchina.module';
import { MadameCocoModule } from './madame-coco/madame-coco.module';
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
import { MeqasaModule } from './meqasa/meqasa.module';
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
import { NykaaModule } from './nykaa/nykaa.module';
import { NotinoModule } from './notino/notino.module';
import { NamshiModule } from './namshi/namshi.module';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NetworkModule } from './network/network.module';
import { NjuskaloModule } from './njuskalo/njuskalo.module';
import { NebimAdapter } from './nebim/nebim.adapter';
import { NoonModule } from './noon/noon.module';
import { NoonSaModule } from './noon-sa/noon-sa.module';
import { NeweggModule } from './newegg/newegg.module';
import { OnbuyModule } from './onbuy/onbuy.module';
import { OttoModule } from './otto/otto.module';
import { OtoplazaModule } from './otoplaza/otoplaza.module';
import { OttoplusModule } from './ottoplus/ottoplus.module';
import { OunassModule } from './ounass/ounass.module';
import { OpencartModule } from './opencart/opencart.module';
import { OlxModule } from './olx/olx.module';
import { OlxPlModule } from './olx-pl/olx-pl.module';
import { OpensooqModule } from './opensooq/opensooq.module';
import { OverstockModule } from './overstock/overstock.module';
import { OzonModule } from './ozon/ozon.module';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumModule } from './pazarama-premium/pazarama-premium.module';
import { Pazar365Module } from './pazar365/pazar365.module';
import { PazaruvajModule } from './pazaruvaj/pazaruvaj.module';
import { PowerDkModule } from './power-dk/power-dk.module';
import { PerigoldModule } from './perigold/perigold.module';
import { PepperfryModule } from './pepperfry/pepperfry.module';
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
import { RazorpayStoreModule } from './razorpay-store/razorpay-store.module';
import { RealdeModule } from './realde/realde.module';
import { ReverbModule } from './reverb/reverb.module';
import { RelianceDigitalModule } from './reliance-digital/reliance-digital.module';
import { RipleyModule } from './ripley/ripley.module';
import { RobomarktModule } from './robomarkt/robomarkt.module';
import { RossmannTrModule } from './rossmann-tr/rossmann-tr.module';
import { RossmannOnlineModule } from './rossmann-online/rossmann-online.module';
import { SahibindenPremiumModule } from './sahibinden-premium/sahibinden-premium.module';
import { SendoModule } from './sendo/sendo.module';
import { SheinModule } from './shein/shein.module';
import { ShopandsendModule } from './shopandsend/shopandsend.module';
import { ShukranModule } from './shukran/shukran.module';
import { SivviModule } from './sivvi/sivvi.module';
import { SharafDgModule } from './sharaf-dg/sharaf-dg.module';
import { ObiTrModule } from './obi-tr/obi-tr.module';
import { OberloModule } from './oberlo/oberlo.module';
import { SahibindenB2bModule } from './sahibinden-b2b/sahibinden-b2b.module';
import { SahibindenProModule } from './sahibinden-pro/sahibinden-pro.module';
import { SpocketModule } from './spocket/spocket.module';
import { SahibindenModule } from './sahibinden/sahibinden.module';
import { SbermarketModule } from './sbermarket/sbermarket.module';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SefamerveModule } from './sefamerve/sefamerve.module';
import { ShopeeModule } from './shopee/shopee.module';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopirollModule } from './shopiroll/shopiroll.module';
import { ShopiverseModule } from './shopiverse/shopiverse.module';
import { ShopigoModule } from './shopigo/shopigo.module';
import { ShohozModule } from './shohoz/shohoz.module';
import { ShopbackModule } from './shopback/shopback.module';
import { SimpraModule } from './simpra/simpra.module';
import { SokMarketModule } from './sok-market/sok-market.module';
import { SnapdealModule } from './snapdeal/snapdeal.module';
import { SnapchatStoreModule } from './snapchat-store/snapchat-store.module';
import { SouqModule } from './souq/souq.module';
import { SportiveModule } from './sportive/sportive.module';
import { SportiveTrModule } from './sportive-tr/sportive-tr.module';
import { SubmarinoModule } from './submarino/submarino.module';
import { StockxModule } from './stockx/stockx.module';
import { SwappaModule } from './swappa/swappa.module';
import { Street11Module } from './street11/street11.module';
import { TakealotModule } from './takealot/takealot.module';
import { TataCliqModule } from './tata-cliq/tata-cliq.module';
import { TikiModule } from './tiki/tiki.module';
import { ThredupModule } from './thredup/thredup.module';
import { TiktokShopModule } from './tiktok-shop/tiktok-shop.module';
import { TikladoModule } from './tiklado/tiklado.module';
import { TrademeModule } from './trademe/trademe.module';
import { TradesyModule } from './tradesy/tradesy.module';
import { TwistModule } from './twist/twist.module';
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
import { UdaanModule } from './udaan/udaan.module';
import { UsPoloTrModule } from './us-polo-tr/us-polo-tr.module';
import { VitacostModule } from './vitacost/vitacost.module';
import { VatanModule } from './vatan/vatan.module';
import { VakkoModule } from './vakko/vakko.module';
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
import { ZandoModule } from './zando/zando.module';
import { KakaoCommerceModule } from './kakao-commerce/kakao-commerce.module';
import { KoganModule } from './kogan/kogan.module';
import { LazadaMyModule } from './lazada-my/lazada-my.module';
import { MercariJpModule } from './mercari-jp/mercari-jp.module';
import { PgmallModule } from './pgmall/pgmall.module';
import { ShopeeBrModule } from './shopee-br/shopee-br.module';
import { ShopeeSgModule } from './shopee-sg/shopee-sg.module';
import { ShopeeThModule } from './shopee-th/shopee-th.module';
import { ThemarketNzModule } from './themarket-nz/themarket-nz.module';
import { YahooAuctionsJpModule } from './yahoo-auctions-jp/yahoo-auctions-jp.module';
import { ZaloraMyModule } from './zalora-my/zalora-my.module';
import { ZozotownModule } from './zozotown/zozotown.module';
import { BrandAlleyModule } from './brand-alley/brand-alley.module';
import { FarfetchModule } from './farfetch/farfetch.module';
import { GrailedModule } from './grailed/grailed.module';
import { MytheresaModule } from './mytheresa/mytheresa.module';
import { NetAPorterModule } from './net-a-porter/net-a-porter.module';
import { PrivaliaModule } from './privalia/privalia.module';
import { RebelleModule } from './rebelle/rebelle.module';
import { ShowroompriveModule } from './showroomprive/showroomprive.module';
import { TiseModule } from './tise/tise.module';
import { VenteExclusiveModule } from './vente-exclusive/vente-exclusive.module';
import { VestiaireModule } from './vestiaire/vestiaire.module';
import { ZalandoLoungeModule } from './zalando-lounge/zalando-lounge.module';
import { ZaraModule } from './zara/zara.module';
import { ZaraTrModule } from './zara-tr/zara-tr.module';
import { ZirveAdapter } from './zirve/zirve.adapter';

@Global()
@Module({
  imports: [
    AdaptersCommonModule,
    AfterpayModule,
    BerealShopModule,
    Brands4lessModule,
    CloverModule,
    GumroadModule,
    HarajModule,
    KlarnaMerchantModule,
    OkxTrModule,
    PaparaModule,
    ParibuModule,
    PatreonModule,
    SquareOnlineModule,
    ThreadsShopModule,
    ToslaModule,
    VendtekModule,
    VenmoBusinessModule,
    XShoppingModule,
    DbaModule,
    DeuxiemeMainModule,
    FinnNoModule,
    FyndiqModule,
    OlxPtModule,
    PricespyModule,
    RicardoChModule,
    ToriModule,
    TraderaModule,
    TuttiChModule,
    TweakersModule,
    TweeDehandsModule,
    WillhabenModule,
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
    KupujemProdajemModule,
    MumzworldModule,
    OlxModule,
    OlxPlModule,
    PowerDkModule,
    AsosModule,
    AlibabaModule,
    AlibabaB2bModule,
    AlibabaTrModule,
    AliexpressRuModule,
    AutodsModule,
    AutotraderModule,
    AvitoModule,
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
    ArticleModule,
    BauhausTrModule,
    BirchLaneModule,
    EnglishHomeModule,
    GardenaModule,
    HouzzModule,
    JossMainModule,
    KaracaModule,
    LinensNThingsModule,
    MadeComModule,
    MadameCocoModule,
    ObiTrModule,
    PerigoldModule,
    BackmarketModule,
    BanabiModule,
    BaymioModule,
    BestbuyModule,
    BeymenModule,
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
    CepteSokModule,
    CatchAuModule,
    CatawikiModule,
    CentralOnlineModule,
    CarrefourMeModule,
    CarrefourFrModule,
    CasinoFrModule,
    CasasBahiaModule,
    CarrefoursaModule,
    CdiscountModule,
    CiceksepetiEvModule,
    CimriModule,
    ColinsModule,
    CoupangModule,
    CoppelModule,
    CostcoCaModule,
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
    FaviModule,
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
    HudsonsBayModule,
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
    KadinClubModule,
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
    LimundoModule,
    LinioModule,
    LiverpoolMxModule,
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
    MeqasaModule,
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
    NetworkModule,
    NjuskaloModule,
    NoonModule,
    NoonSaModule,
    NeweggModule,
    OnbuyModule,
    OpencartModule,
    OverstockModule,
    OttoModule,
    OtoplazaModule,
    OttoplusModule,
    OunassModule,
    OpensooqModule,
    OzonModule,
    PazaramaPremiumModule,
    Pazar365Module,
    PazaruvajModule,
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
    RipleyModule,
    RobomarktModule,
    RossmannTrModule,
    RossmannOnlineModule,
    SahibindenModule,
    SbermarketModule,
    SahibindenB2bModule,
    SahibindenProModule,
    SpocketModule,
    SahibindenPremiumModule,
    SendoModule,
    SheinModule,
    ShopandsendModule,
    ShukranModule,
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
    SubmarinoModule,
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
    TwistModule,
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
    UsPoloTrModule,
    VitacostModule,
    VatanModule,
    VakkoModule,
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
    ZandoModule,
    ZaraModule,
    ZaraTrModule,
    KakaoCommerceModule,
    KoganModule,
    LazadaMyModule,
    MercariJpModule,
    PgmallModule,
    ShopeeBrModule,
    ShopeeSgModule,
    ShopeeThModule,
    ThemarketNzModule,
    YahooAuctionsJpModule,
    ZaloraMyModule,
    ZozotownModule,
    BrandAlleyModule,
    FarfetchModule,
    GrailedModule,
    MytheresaModule,
    NetAPorterModule,
    PrivaliaModule,
    RebelleModule,
    ShowroompriveModule,
    TiseModule,
    VenteExclusiveModule,
    VestiaireModule,
    ZalandoLoungeModule,
    ChaldalModule,
    CraftsvillaModule,
    DarazPkModule,
    GotoLkModule,
    JuspayModule,
    KhaadiModule,
    LimeroadModule,
    NykaaModule,
    PepperfryModule,
    RazorpayStoreModule,
    RelianceDigitalModule,
    ShohozModule,
    TataCliqModule,
    UdaanModule,
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
    AliexpressRuModule,
    AutodsModule,
    AutotraderModule,
    AvitoModule,
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
    ArticleModule,
    BauhausTrModule,
    BirchLaneModule,
    EnglishHomeModule,
    GardenaModule,
    HouzzModule,
    JossMainModule,
    KaracaModule,
    LinensNThingsModule,
    MadeComModule,
    MadameCocoModule,
    ObiTrModule,
    PerigoldModule,
    BackmarketModule,
    BanabiModule,
    BaymioModule,
    BestbuyModule,
    BeymenModule,
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
    CepteSokModule,
    CatchAuModule,
    CatawikiModule,
    CentralOnlineModule,
    CarrefourMeModule,
    CarrefourFrModule,
    CasinoFrModule,
    CasasBahiaModule,
    CarrefoursaModule,
    CdiscountModule,
    CiceksepetiEvModule,
    CimriModule,
    ColinsModule,
    CoupangModule,
    CoppelModule,
    CostcoCaModule,
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
    FaviModule,
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
    HudsonsBayModule,
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
    KadinClubModule,
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
    LimundoModule,
    LinioModule,
    LiverpoolMxModule,
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
    MeqasaModule,
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
    NetworkModule,
    NjuskaloModule,
    NoonModule,
    NoonSaModule,
    NeweggModule,
    OnbuyModule,
    OpencartModule,
    OverstockModule,
    OttoModule,
    OtoplazaModule,
    OttoplusModule,
    OunassModule,
    OpensooqModule,
    OzonModule,
    PazaramaPremiumModule,
    Pazar365Module,
    PazaruvajModule,
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
    RipleyModule,
    RobomarktModule,
    RossmannTrModule,
    RossmannOnlineModule,
    SahibindenModule,
    SbermarketModule,
    SahibindenB2bModule,
    SahibindenProModule,
    SpocketModule,
    SahibindenPremiumModule,
    SendoModule,
    SheinModule,
    ShopandsendModule,
    ShukranModule,
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
    SubmarinoModule,
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
    TwistModule,
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
    UsPoloTrModule,
    VitacostModule,
    VatanModule,
    VakkoModule,
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
    ZandoModule,
    ZaraModule,
    AfterpayModule,
    BerealShopModule,
    Brands4lessModule,
    CloverModule,
    GumroadModule,
    HarajModule,
    KlarnaMerchantModule,
    OkxTrModule,
    PaparaModule,
    ParibuModule,
    PatreonModule,
    SquareOnlineModule,
    ThreadsShopModule,
    ToslaModule,
    VendtekModule,
    VenmoBusinessModule,
    XShoppingModule,
    ZaraTrModule,
    KakaoCommerceModule,
    KoganModule,
    LazadaMyModule,
    MercariJpModule,
    PgmallModule,
    ShopeeBrModule,
    ShopeeSgModule,
    ShopeeThModule,
    ThemarketNzModule,
    YahooAuctionsJpModule,
    ZaloraMyModule,
    ZozotownModule,
    BrandAlleyModule,
    FarfetchModule,
    GrailedModule,
    MytheresaModule,
    NetAPorterModule,
    PrivaliaModule,
    RebelleModule,
    ShowroompriveModule,
    TiseModule,
    VenteExclusiveModule,
    VestiaireModule,
    ZalandoLoungeModule,
    ChaldalModule,
    CraftsvillaModule,
    DarazPkModule,
    GotoLkModule,
    JuspayModule,
    KhaadiModule,
    LimeroadModule,
    NykaaModule,
    PepperfryModule,
    RazorpayStoreModule,
    RelianceDigitalModule,
    ShohozModule,
    TataCliqModule,
    UdaanModule,
    DbaModule,
  ],
})
export class AdapterModule {}
