import { Injectable, NotFoundException } from '@nestjs/common';
import type { IErpAdapter, IMarketplaceAdapter, IEcommerceAdapter } from '@senkronize/shared';

import { A101Adapter } from './a101/a101.adapter';
import { AboutYouAdapter } from './about-you/about-you.adapter';
import { AddaxAdapter } from './addax/addax.adapter';
import { AdidasTrAdapter } from './adidas-tr/adidas-tr.adapter';
import { AldiAdapter } from './aldi/aldi.adapter';
import { AlisverisComAdapter } from './alisveris-com/alisveris-com.adapter';
import { AwokAdapter } from './awok/awok.adapter';
import { AsosAdapter } from './asos/asos.adapter';
import { AlibabaAdapter } from './alibaba/alibaba.adapter';
import { AlibabaB2bAdapter } from './alibaba-b2b/alibaba-b2b.adapter';
import { AlibabaTrAdapter } from './alibaba-tr/alibaba-tr.adapter';
import { AutodsAdapter } from './autods/autods.adapter';
import { AutotraderAdapter } from './autotrader/autotrader.adapter';
import { AkinonAdapter } from './akinon/akinon.adapter';
import { AkulakuAdapter } from './akulaku/akulaku.adapter';
import { AmericanasAdapter } from './americanas/americanas.adapter';
import { AllegroAdapter } from './allegro/allegro.adapter';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonAeAdapter } from './amazon-ae/amazon-ae.adapter';
import { AmazonCaAdapter } from './amazon-ca/amazon-ca.adapter';
import { AmazonDeAdapter } from './amazon-de/amazon-de.adapter';
import { AmazonEuAdapter } from './amazon-eu/amazon-eu.adapter';
import { AmazonFrAdapter } from './amazon-fr/amazon-fr.adapter';
import { AmazonJpAdapter } from './amazon-jp/amazon-jp.adapter';
import { AmazonUkAdapter } from './amazon-uk/amazon-uk.adapter';
import { ArcelikAdapter } from './arcelik/arcelik.adapter';
import { AracimAdapter } from './aracim/aracim.adapter';
import { ArticleAdapter } from './article/article.adapter';
import { ArtsyAdapter } from './artsy/artsy.adapter';
import { BoutiqaatAdapter } from './boutiqaat/boutiqaat.adapter';
import { BackmarketAdapter } from './backmarket/backmarket.adapter';
import { BauhausTrAdapter } from './bauhaus-tr/bauhaus-tr.adapter';
import { BanabiAdapter } from './banabi/banabi.adapter';
import { BestbuyAdapter } from './bestbuy/bestbuy.adapter';
import { BigwAdapter } from './bigw/bigw.adapter';
import { BirchLaneAdapter } from './birch-lane/birch-lane.adapter';
import { BidorbuyAdapter } from './bidorbuy/bidorbuy.adapter';
import { BizimHesapErpAdapter } from './erp/bizimhesap-erp.adapter';
import { LogoErpAdapter } from './erp/logo-erp.adapter';
import { ParasutErpAdapter } from './erp/parasut-erp.adapter';
import { BizimMuhasebeAdapter } from './bizim-muhasebe/bizim-muhasebe.adapter';
import { BimOnlineAdapter } from './bim-online/bim-online.adapter';
import { BimakilliAdapter } from './bimakilli/bimakilli.adapter';
import { BolcomAdapter } from './bolcom/bolcom.adapter';
import { BonanzaAdapter } from './bonanza/bonanza.adapter';
import { BuyukMagazaAdapter } from './buyuk-magaza/buyuk-magaza.adapter';
import { BlibliAdapter } from './blibli/blibli.adapter';
import { BukalapakAdapter } from './bukalapak/bukalapak.adapter';
import { BuldumbuldumAdapter } from './buldumbuldum/buldumbuldum.adapter';
import { BoynerAdapter } from './boyner/boyner.adapter';
import { CatchAuAdapter } from './catch-au/catch-au.adapter';
import { CatawikiAdapter } from './catawiki/catawiki.adapter';
import { CentralOnlineAdapter } from './central-online/central-online.adapter';
import { CarrefoursaAdapter } from './carrefoursa/carrefoursa.adapter';
import { CarrefourMeAdapter } from './carrefour-me/carrefour-me.adapter';
import { CarrefourFrAdapter } from './carrefour-fr/carrefour-fr.adapter';
import { CasasBahiaAdapter } from './casas-bahia/casas-bahia.adapter';
import { CasinoFrAdapter } from './casino-fr/casino-fr.adapter';
import { CdonAdapter } from './cdon/cdon.adapter';
import { CdiscountAdapter } from './cdiscount/cdiscount.adapter';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { CiceksepetiEvAdapter } from './ciceksepeti-ev/ciceksepeti-ev.adapter';
import { CeneoAdapter } from './ceneo/ceneo.adapter';
import { ChairishAdapter } from './chairish/chairish.adapter';
import { CimriAdapter } from './cimri/cimri.adapter';
import { CoupangAdapter } from './coupang/coupang.adapter';
import { CoppelAdapter } from './coppel/coppel.adapter';
import { CostcoCaAdapter } from './costco-ca/costco-ca.adapter';
import { CultBeautyAdapter } from './cult-beauty/cult-beauty.adapter';
import { DefactoAdapter } from './defacto/defacto.adapter';
import { DeliverooAdapter } from './deliveroo/deliveroo.adapter';
import { DhgateAdapter } from './dhgate/dhgate.adapter';
import { DobaAdapter } from './doba/doba.adapter';
import { DopingAdapter } from './doping/doping.adapter';
import { DarazAdapter } from './daraz/daraz.adapter';
import { DecathlonAdapter } from './decathlon/decathlon.adapter';
import { DecathlonTrAdapter } from './decathlon-tr/decathlon-tr.adapter';
import { DecluttrAdapter } from './decluttr/decluttr.adapter';
import { DepopAdapter } from './depop/depop.adapter';
import { DlgamerAdapter } from './dlgamer/dlgamer.adapter';
import { DustinAdapter } from './dustin/dustin.adapter';
import { DolapAdapter } from './dolap/dolap.adapter';
import { DrAdapter } from './dr/dr.adapter';
import { EnglishHomeAdapter } from './english-home/english-home.adapter';
import { EllosAdapter } from './ellos/ellos.adapter';
import { Ec21Adapter } from './ec21/ec21.adapter';
import { EbayAdapter } from './ebay/ebay.adapter';
import { EbayMotorsAdapter } from './ebay-motors/ebay-motors.adapter';
import { ElektraAdapter } from './elektra/elektra.adapter';
import { EmagAdapter } from './emag/emag.adapter';
import { EnebaAdapter } from './eneba/eneba.adapter';
import { EnparaAdapter } from './enpara/enpara.adapter';
import { EtaAdapter } from './eta/eta.adapter';
import { EtsyAdapter } from './etsy/etsy.adapter';
import { EvideaAdapter } from './evidea/evidea.adapter';
import { ExportifyAdapter } from './exportify/exportify.adapter';
import { FinansMuhasebeAdapter } from './finans-muhasebe/finans-muhasebe.adapter';
import { FirstdibsAdapter } from './firstdibs/firstdibs.adapter';
import { FlipkartAdapter } from './flipkart/flipkart.adapter';
import { FnacAdapter } from './fnac/fnac.adapter';
import { FruugoAdapter } from './fruugo/fruugo.adapter';
import { FaprikaAdapter } from './faprika/faprika.adapter';
import { FalabellaAdapter } from './falabella/falabella.adapter';
import { FloAdapter } from './flo/flo.adapter';
import { FuudyAdapter } from './fuudy/fuudy.adapter';
import { GetirFoodAdapter } from './getir-food/getir-food.adapter';
import { GetirMarketAdapter } from './getir-market/getir-market.adapter';
import { GetirYemekAdapter } from './getir-yemek/getir-yemek.adapter';
import { GetirAdapter } from './getir/getir.adapter';
import { GorillasAdapter } from './gorillas/gorillas.adapter';
import { GotoBusinessAdapter } from './goto-business/goto-business.adapter';
import { GmarketAdapter } from './gmarket/gmarket.adapter';
import { GrabMartAdapter } from './grab-mart/grab-mart.adapter';
import { GlobalSourcesAdapter } from './global-sources/global-sources.adapter';
import { GardenaAdapter } from './gardena/gardena.adapter';
import { G2aAdapter } from './g2a/g2a.adapter';
import { GameflipAdapter } from './gameflip/gameflip.adapter';
import { GittigidiyorAdapter } from './gittigidiyor/gittigidiyor.adapter';
import { GratisAdapter } from './gratis/gratis.adapter';
import { GymsharkAdapter } from './gymshark/gymshark.adapter';
import { HellofreshAdapter } from './hellofresh/hellofresh.adapter';
import { HeurekaAdapter } from './heureka/heureka.adapter';
import { IherbAdapter } from './iherb/iherb.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumAdapter } from './hepsiburada-premium/hepsiburada-premium.adapter';
import { HepsiexpressAdapter } from './hepsiexpress/hepsiexpress.adapter';
import { HizliresmiAdapter } from './hizliresmi/hizliresmi.adapter';
import { HouzzAdapter } from './houzz/houzz.adapter';
import { HarveyNormanAdapter } from './harvey-norman/harvey-norman.adapter';
import { HudsonsBayAdapter } from './hudsons-bay/hudsons-bay.adapter';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IdealoAdapter } from './idealo/idealo.adapter';
import { IndiamartAdapter } from './indiamart/indiamart.adapter';
import { IdefixAdapter } from './idefix/idefix.adapter';
import { InstacartAdapter } from './instacart/instacart.adapter';
import { InstagramShopAdapter } from './instagram-shop/instagram-shop.adapter';
import { IntersportTrAdapter } from './intersport-tr/intersport-tr.adapter';
import { IkasAdapter } from './ikas/ikas.adapter';
import { IkasMpAdapter } from './ikas-mp/ikas-mp.adapter';
import { IsnetAdapter } from './isnet/isnet.adapter';
import { IyzicoAdapter } from './iyzico/iyzico.adapter';
import { JdidAdapter } from './jdid/jdid.adapter';
import { JdcomAdapter } from './jdcom/jdcom.adapter';
import { JetAdapter } from './jet/jet.adapter';
import { JiomartAdapter } from './jiomart/jiomart.adapter';
import { JossMainAdapter } from './joss-main/joss-main.adapter';
import { JoomAdapter } from './joom/joom.adapter';
import { JumiaAdapter } from './jumia/jumia.adapter';
import { LamodaAdapter } from './lamoda/lamoda.adapter';
import { KauflandAdapter } from './kaufland/kaufland.adapter';
import { KaracaAdapter } from './karaca/karaca.adapter';
import { KaspiAdapter } from './kaspi/kaspi.adapter';
import { KomplettAdapter } from './komplett/komplett.adapter';
import { KilimallAdapter } from './kilimall/kilimall.adapter';
import { KinguinAdapter } from './kinguin/kinguin.adapter';
import { KitapyurduAdapter } from './kitapyurdu/kitapyurdu.adapter';
import { KmartAuAdapter } from './kmart-au/kmart-au.adapter';
import { KongaAdapter } from './konga/konga.adapter';
import { KoctasAdapter } from './koctas/koctas.adapter';
import { KolaybiAdapter } from './kolaybi/kolaybi.adapter';
import { KotonAdapter } from './koton/koton.adapter';
import { LcwaikikiAdapter } from './lcwaikiki/lcwaikiki.adapter';
import { LookfantasticAdapter } from './lookfantastic/lookfantastic.adapter';
import { LidyanaAdapter } from './lidyana/lidyana.adapter';
import { LidlAdapter } from './lidl/lidl.adapter';
import { LinensNThingsAdapter } from './linens-n-things/linens-n-things.adapter';
import { LinioAdapter } from './linio/linio.adapter';
import { LiverpoolMxAdapter } from './liverpool-mx/liverpool-mx.adapter';
import { LogoCommerceAdapter } from './logo-commerce/logo-commerce.adapter';
import { LogoCloudAdapter } from './logo-cloud/logo-cloud.adapter';
import { LazadaAdapter } from './lazada/lazada.adapter';
import { LazadaPhAdapter } from './lazada-ph/lazada-ph.adapter';
import { LaredouteAdapter } from './laredoute/laredoute.adapter';
import { LetgoAdapter } from './letgo/letgo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeComAdapter } from './made-com/made-com.adapter';
import { MadeinchinaAdapter } from './madeinchina/madeinchina.adapter';
import { MadameCocoAdapter } from './madame-coco/madame-coco.adapter';
import { MagaluAdapter } from './magalu/magalu.adapter';
import { MallCzAdapter } from './mall-cz/mall-cz.adapter';
import { MagentoAdapter } from './magento/magento.adapter';
import { MedusaAdapter } from './medusa/medusa.adapter';
import { ManomanoAdapter } from './manomano/manomano.adapter';
import { MaviAdapter } from './mavi/mavi.adapter';
import { MediamarktAdapter } from './mediamarkt/mediamarkt.adapter';
import { MediamarktTrAdapter } from './mediamarkt-tr/mediamarkt-tr.adapter';
import { MeeshoAdapter } from './meesho/meesho.adapter';
import { MercadolibreAdapter } from './mercadolibre/mercadolibre.adapter';
import { MercariAdapter } from './mercari/mercari.adapter';
import { MeqasaAdapter } from './meqasa/meqasa.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MikroBulutAdapter } from './mikro-bulut/mikro-bulut.adapter';
import { MigrosAdapter } from './migros/migros.adapter';
import { MigrosHizliAdapter } from './migros-hizli/migros-hizli.adapter';
import { MigrosSanalAdapter } from './migros-sanal/migros-sanal.adapter';
import { MydealAdapter } from './mydeal/mydeal.adapter';
import { MigroshemenAdapter } from './migroshemen/migroshemen.adapter';
import { MiintoAdapter } from './miinto/miinto.adapter';
import { MumzworldAdapter } from './mumzworld/mumzworld.adapter';
import { ModacruzAdapter } from './modacruz/modacruz.adapter';
import { ModanisaAdapter } from './modanisa/modanisa.adapter';
import { MorhipoAdapter } from './morhipo/morhipo.adapter';
import { MysoftAdapter } from './mysoft/mysoft.adapter';
import { MyntraAdapter } from './myntra/myntra.adapter';
import { N11Adapter } from './n11/n11.adapter';
import { N11ProAdapter } from './n11-pro/n11-pro.adapter';
import { NotinoAdapter } from './notino/notino.adapter';
import { ObiTrAdapter } from './obi-tr/obi-tr.adapter';
import { OberloAdapter } from './oberlo/oberlo.adapter';
import { NamshiAdapter } from './namshi/namshi.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NebimAdapter } from './nebim/nebim.adapter';
import { NoonAdapter } from './noon/noon.adapter';
import { NoonSaAdapter } from './noon-sa/noon-sa.adapter';
import { NeweggAdapter } from './newegg/newegg.adapter';
import { OnbuyAdapter } from './onbuy/onbuy.adapter';
import { OpencartAdapter } from './opencart/opencart.adapter';
import { OlxAdapter } from './olx/olx.adapter';
import { OpensooqAdapter } from './opensooq/opensooq.adapter';
import { OverstockAdapter } from './overstock/overstock.adapter';
import { OttoAdapter } from './otto/otto.adapter';
import { OtoplazaAdapter } from './otoplaza/otoplaza.adapter';
import { OunassAdapter } from './ounass/ounass.adapter';
import { OzonAdapter } from './ozon/ozon.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumAdapter } from './pazarama-premium/pazarama-premium.adapter';
import { Pazar365Adapter } from './pazar365/pazar365.adapter';
import { PowerDkAdapter } from './power-dk/power-dk.adapter';
import { PerigoldAdapter } from './perigold/perigold.adapter';
import { PorlandAdapter } from './porland/porland.adapter';
import { PoshmarkAdapter } from './poshmark/poshmark.adapter';
import { PiguAdapter } from './pigu/pigu.adapter';
import { PrestashopAdapter } from './prestashop/prestashop.adapter';
import { PricerunnerAdapter } from './pricerunner/pricerunner.adapter';
import { PinterestAdapter } from './pinterest/pinterest.adapter';
import { PinktrottersAdapter } from './pinktrotters/pinktrotters.adapter';
import { SaleorAdapter } from './saleor/saleor.adapter';
import { ProtelAdapter } from './protel/protel.adapter';
import { Qoo10Adapter } from './qoo10/qoo10.adapter';
import { RakutenAdapter } from './rakuten/rakuten.adapter';
import { RealdeAdapter } from './realde/realde.adapter';
import { ReverbAdapter } from './reverb/reverb.adapter';
import { RipleyAdapter } from './ripley/ripley.adapter';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { RobomarktAdapter } from './robomarkt/robomarkt.adapter';
import { RossmannTrAdapter } from './rossmann-tr/rossmann-tr.adapter';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SahibindenPremiumAdapter } from './sahibinden-premium/sahibinden-premium.adapter';
import { SendoAdapter } from './sendo/sendo.adapter';
import { SheinAdapter } from './shein/shein.adapter';
import { ShopandsendAdapter } from './shopandsend/shopandsend.adapter';
import { ShukranAdapter } from './shukran/shukran.adapter';
import { SivviAdapter } from './sivvi/sivvi.adapter';
import { SharafDgAdapter } from './sharaf-dg/sharaf-dg.adapter';
import { SahibindenB2bAdapter } from './sahibinden-b2b/sahibinden-b2b.adapter';
import { SahibindenProAdapter } from './sahibinden-pro/sahibinden-pro.adapter';
import { SahibindenAdapter } from './sahibinden/sahibinden.adapter';
import { SpocketAdapter } from './spocket/spocket.adapter';
import { SefamerveAdapter } from './sefamerve/sefamerve.adapter';
import { ShopeeAdapter } from './shopee/shopee.adapter';
import { SimpraAdapter } from './simpra/simpra.adapter';
import { SokMarketAdapter } from './sok-market/sok-market.adapter';
import { SnapdealAdapter } from './snapdeal/snapdeal.adapter';
import { SnapchatStoreAdapter } from './snapchat-store/snapchat-store.adapter';
import { ShopirollAdapter } from './shopiroll/shopiroll.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopiverseAdapter } from './shopiverse/shopiverse.adapter';
import { ShopigoAdapter } from './shopigo/shopigo.adapter';
import { ShopbackAdapter } from './shopback/shopback.adapter';
import { SouqAdapter } from './souq/souq.adapter';
import { SportiveAdapter } from './sportive/sportive.adapter';
import { SportiveTrAdapter } from './sportive-tr/sportive-tr.adapter';
import { SubmarinoAdapter } from './submarino/submarino.adapter';
import { StockxAdapter } from './stockx/stockx.adapter';
import { SwappaAdapter } from './swappa/swappa.adapter';
import { Street11Adapter } from './street11/street11.adapter';
import { TakealotAdapter } from './takealot/takealot.adapter';
import { TedarikciAdapter } from './tedarikci/tedarikci.adapter';
import { TikiAdapter } from './tiki/tiki.adapter';
import { ToptaneviAdapter } from './toptanevi/toptanevi.adapter';
import { TradeindiaAdapter } from './tradeindia/tradeindia.adapter';
import { ThredupAdapter } from './thredup/thredup.adapter';
import { TiktokShopAdapter } from './tiktok-shop/tiktok-shop.adapter';
import { TikladoAdapter } from './tiklado/tiklado.adapter';
import { TrademeAdapter } from './trademe/trademe.adapter';
import { TradesyAdapter } from './tradesy/tradesy.adapter';
import { StripeAdapter } from './stripe/stripe.adapter';
import { SpartooAdapter } from './spartoo/spartoo.adapter';
import { TeknosaAdapter } from './teknosa/teknosa.adapter';
import { TemuAdapter } from './temu/temu.adapter';
import { TicimaxErpAdapter } from './erp/ticimax-erp.adapter';
import { TsoftErpAdapter } from './erp/tsoft-erp.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TicimaxMpAdapter } from './ticimax-mp/ticimax-mp.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TrendyolPremiumAdapter } from './trendyol-premium/trendyol-premium.adapter';
import { TrendyolGoAdapter } from './trendyol-go/trendyol-go.adapter';
import { TrendyolGroceriesAdapter } from './trendyol-groceries/trendyol-groceries.adapter';
import { TrendyolMillaAdapter } from './trendyol-milla/trendyol-milla.adapter';
import { TrendyolIntAdapter } from './trendyol-int/trendyol-int.adapter';
import { TrendyolSecondHandAdapter } from './trendyol-second-hand/trendyol-second-hand.adapter';
import { TrendyolYemekAdapter } from './trendyol-yemek/trendyol-yemek.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { VendureAdapter } from './vendure/vendure.adapter';
import { TazeDirektAdapter } from './taze-direkt/taze-direkt.adapter';
import { TargetPlusAdapter } from './target-plus/target-plus.adapter';
import { TokopediaAdapter } from './tokopedia/tokopedia.adapter';
import { UniposAdapter } from './unipos/unipos.adapter';
import { UberEatsAdapter } from './uber-eats/uber-eats.adapter';
import { UzumAdapter } from './uzum/uzum.adapter';
import { VitacostAdapter } from './vitacost/vitacost.adapter';
import { VatanAdapter } from './vatan/vatan.adapter';
import { VintedAdapter } from './vinted/vinted.adapter';
import { VeepeeAdapter } from './veepee/veepee.adapter';
import { WadiAdapter } from './wadi/wadi.adapter';
import { VestelAdapter } from './vestel/vestel.adapter';
import { VivenseAdapter } from './vivense/vivense.adapter';
import { WildberriesAdapter } from './wildberries/wildberries.adapter';
import { WishAdapter } from './wish/wish.adapter';
import { YandexMarketAdapter } from './yandex-market/yandex-market.adapter';
import { WalmartAdapter } from './walmart/walmart.adapter';
import { WatsonsTrAdapter } from './watsons-tr/watsons-tr.adapter';
import { WhatsappCommerceAdapter } from './whatsapp-commerce/whatsapp-commerce.adapter';
import { WayfairAdapter } from './wayfair/wayfair.adapter';
import { WebmotorsAdapter } from './webmotors/webmotors.adapter';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';
import { YargiciAdapter } from './yargici/yargici.adapter';
import { YoutubeShopAdapter } from './youtube-shop/youtube-shop.adapter';
import { YemeksepetiAdapter } from './yemeksepeti/yemeksepeti.adapter';
import { ZalandoAdapter } from './zalando/zalando.adapter';
import { ZaraAdapter } from './zara/zara.adapter';
import { ZaraTrAdapter } from './zara-tr/zara-tr.adapter';
import { ZirveAdapter } from './zirve/zirve.adapter';
import { AfterpayAdapter } from './afterpay/afterpay.adapter';
import { BerealShopAdapter } from './bereal-shop/bereal-shop.adapter';
import { Brands4lessAdapter } from './brands4less/brands4less.adapter';
import { CloverAdapter } from './clover/clover.adapter';
import { GumroadAdapter } from './gumroad/gumroad.adapter';
import { HarajAdapter } from './haraj/haraj.adapter';
import { KlarnaMerchantAdapter } from './klarna-merchant/klarna-merchant.adapter';
import { OkxTrAdapter } from './okx-tr/okx-tr.adapter';
import { PaparaAdapter } from './papara/papara.adapter';
import { ParibuAdapter } from './paribu/paribu.adapter';
import { PatreonAdapter } from './patreon/patreon.adapter';
import { SquareOnlineAdapter } from './square-online/square-online.adapter';
import { ThreadsShopAdapter } from './threads-shop/threads-shop.adapter';
import { ToslaAdapter } from './tosla/tosla.adapter';
import { VendtekAdapter } from './vendtek/vendtek.adapter';
import { VenmoBusinessAdapter } from './venmo-business/venmo-business.adapter';
import { XShoppingAdapter } from './x-shopping/x-shopping.adapter';
import { ZandoAdapter } from './zando/zando.adapter';
import { KakaoCommerceAdapter } from './kakao-commerce/kakao-commerce.adapter';
import { KoganAdapter } from './kogan/kogan.adapter';
import { LazadaMyAdapter } from './lazada-my/lazada-my.adapter';
import { MercariJpAdapter } from './mercari-jp/mercari-jp.adapter';
import { PgmallAdapter } from './pgmall/pgmall.adapter';
import { ShopeeBrAdapter } from './shopee-br/shopee-br.adapter';
import { ShopeeSgAdapter } from './shopee-sg/shopee-sg.adapter';
import { ShopeeThAdapter } from './shopee-th/shopee-th.adapter';
import { ThemarketNzAdapter } from './themarket-nz/themarket-nz.adapter';
import { YahooAuctionsJpAdapter } from './yahoo-auctions-jp/yahoo-auctions-jp.adapter';
import { ZaloraMyAdapter } from './zalora-my/zalora-my.adapter';
import { ZozotownAdapter } from './zozotown/zozotown.adapter';
import { BrandAlleyAdapter } from './brand-alley/brand-alley.adapter';
import { FarfetchAdapter } from './farfetch/farfetch.adapter';
import { GrailedAdapter } from './grailed/grailed.adapter';
import { MytheresaAdapter } from './mytheresa/mytheresa.adapter';
import { NetAPorterAdapter } from './net-a-porter/net-a-porter.adapter';
import { PrivaliaAdapter } from './privalia/privalia.adapter';
import { RebelleAdapter } from './rebelle/rebelle.adapter';
import { ShowroompriveAdapter } from './showroomprive/showroomprive.adapter';
import { TiseAdapter } from './tise/tise.adapter';
import { VenteExclusiveAdapter } from './vente-exclusive/vente-exclusive.adapter';
import { VestiaireAdapter } from './vestiaire/vestiaire.adapter';
import { ZalandoLoungeAdapter } from './zalando-lounge/zalando-lounge.adapter';
import { ErpAdapterRegistry } from './erp/erp-adapter.registry';
import { EcommerceAdapterRegistry } from './ecommerce/ecommerce-adapter.registry';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, IMarketplaceAdapter>;
  private readonly erpAdapters: Map<string, IErpAdapter>;
  private readonly ecommerceAdapters: Map<string, IEcommerceAdapter>;

  constructor(
    private readonly amazon: AmazonAdapter,
    private readonly amazonAe: AmazonAeAdapter,
    private readonly amazonCa: AmazonCaAdapter,
    private readonly amazonDe: AmazonDeAdapter,
    private readonly amazonEu: AmazonEuAdapter,
    private readonly amazonFr: AmazonFrAdapter,
    private readonly amazonJp: AmazonJpAdapter,
    private readonly amazonUk: AmazonUkAdapter,
    private readonly allegro: AllegroAdapter,
    private readonly wildberries: WildberriesAdapter,
    private readonly walmart: WalmartAdapter,
    private readonly wayfair: WayfairAdapter,
    private readonly webmotors: WebmotorsAdapter,
    private readonly ozon: OzonAdapter,
    private readonly noon: NoonAdapter,
    private readonly noonSa: NoonSaAdapter,
    private readonly newegg: NeweggAdapter,
    private readonly cdiscount: CdiscountAdapter,
    private readonly kaufland: KauflandAdapter,
    private readonly karaca: KaracaAdapter,
    private readonly kaspi: KaspiAdapter,
    private readonly trendyol: TrendyolAdapter,
    private readonly hellofresh: HellofreshAdapter,
    private readonly heureka: HeurekaAdapter,
    private readonly iherb: IherbAdapter,
    private readonly hepsiburada: HepsiburadaAdapter,
    private readonly n11: N11Adapter,
    private readonly ciceksepeti: CiceksepetiAdapter,
    private readonly ideasoft: IdeasoftAdapter,
    private readonly bizimhesap: BizimHesapErpAdapter,
    private readonly parasut: ParasutErpAdapter,
    private readonly logo: LogoErpAdapter,
    private readonly mikro: MikroAdapter,
    private readonly luca: LucaAdapter,
    private readonly tsoft: TsoftAdapter,
    private readonly tsoftErp: TsoftErpAdapter,
    private readonly ticimax: TicimaxAdapter,
    private readonly ticimaxErp: TicimaxErpAdapter,
    private readonly pttavm: PttavmAdapter,
    private readonly pazarama: PazaramaAdapter,
    private readonly woocommerce: WoocommerceAdapter,
    private readonly shopify: ShopifyAdapter,
    private readonly netsis: NetsisAdapter,
    private readonly eta: EtaAdapter,
    private readonly isnet: IsnetAdapter,
    private readonly kolaybi: KolaybiAdapter,
    private readonly nebim: NebimAdapter,
    private readonly sapB1: SapB1Adapter,
    private readonly zirve: ZirveAdapter,
    private readonly getir: GetirAdapter,
    private readonly gratis: GratisAdapter,
    private readonly boyner: BoynerAdapter,
    private readonly mumzworld: MumzworldAdapter,
    private readonly morhipo: MorhipoAdapter,
    private readonly dolap: DolapAdapter,
    private readonly englishHome: EnglishHomeAdapter,
    private readonly ellos: EllosAdapter,
    private readonly ebay: EbayAdapter,
    private readonly ebayMotors: EbayMotorsAdapter,
    private readonly etsy: EtsyAdapter,
    private readonly temu: TemuAdapter,
    private readonly sahibinden: SahibindenAdapter,
    private readonly migros: MigrosAdapter,
    private readonly hepsiexpress: HepsiexpressAdapter,
    private readonly flo: FloAdapter,
    private readonly cultBeauty: CultBeautyAdapter,
    private readonly defacto: DefactoAdapter,
    private readonly deliveroo: DeliverooAdapter,
    private readonly doping: DopingAdapter,
    private readonly lcwaikiki: LcwaikikiAdapter,
    private readonly lookfantastic: LookfantasticAdapter,
    private readonly vatan: VatanAdapter,
    private readonly veepee: VeepeeAdapter,
    private readonly mediamarkt: MediamarktAdapter,
    private readonly mediamarktTr: MediamarktTrAdapter,
    private readonly teknosa: TeknosaAdapter,
    private readonly koton: KotonAdapter,
    private readonly mavi: MaviAdapter,
    private readonly magento: MagentoAdapter,
    private readonly manomano: ManomanoAdapter,
    private readonly prestashop: PrestashopAdapter,
    private readonly pricerunner: PricerunnerAdapter,
    private readonly pinterest: PinterestAdapter,
    private readonly pinktrotters: PinktrottersAdapter,
    private readonly opencart: OpencartAdapter,
    private readonly olx: OlxAdapter,
    private readonly opensooq: OpensooqAdapter,
    private readonly overstock: OverstockAdapter,
    private readonly faprika: FaprikaAdapter,
    private readonly unipos: UniposAdapter,
    private readonly uberEats: UberEatsAdapter,
    private readonly uzum: UzumAdapter,
    private readonly vitacost: VitacostAdapter,
    private readonly akinon: AkinonAdapter,
    private readonly intersportTr: IntersportTrAdapter,
    private readonly ikas: IkasAdapter,
    private readonly a101: A101Adapter,
    private readonly aboutYou: AboutYouAdapter,
    private readonly asos: AsosAdapter,
    private readonly arcelik: ArcelikAdapter,
    private readonly aracim: AracimAdapter,
    private readonly article: ArticleAdapter,
    private readonly artsy: ArtsyAdapter,
    private readonly backmarket: BackmarketAdapter,
    private readonly bauhausTr: BauhausTrAdapter,
    private readonly banabi: BanabiAdapter,
    private readonly bestbuy: BestbuyAdapter,
    private readonly bigw: BigwAdapter,
    private readonly birchLane: BirchLaneAdapter,
    private readonly bidorbuy: BidorbuyAdapter,
    private readonly bimakilli: BimakilliAdapter,
    private readonly bimOnline: BimOnlineAdapter,
    private readonly elektra: ElektraAdapter,
    private readonly migroshemen: MigroshemenAdapter,
    private readonly migrosHizli: MigrosHizliAdapter,
    private readonly miinto: MiintoAdapter,
    private readonly migrosSanal: MigrosSanalAdapter,
    private readonly robomarkt: RobomarktAdapter,
    private readonly rossmannTr: RossmannTrAdapter,
    private readonly shopigo: ShopigoAdapter,
    private readonly shopback: ShopbackAdapter,
    private readonly trendyolGo: TrendyolGoAdapter,
    private readonly trendyolGroceries: TrendyolGroceriesAdapter,
    private readonly trendyolInt: TrendyolIntAdapter,
    private readonly trendyolMilla: TrendyolMillaAdapter,
    private readonly trendyolSecondHand: TrendyolSecondHandAdapter,
    private readonly vestel: VestelAdapter,
    private readonly addax: AddaxAdapter,
    private readonly adidasTr: AdidasTrAdapter,
    private readonly aldi: AldiAdapter,
    private readonly awok: AwokAdapter,
    private readonly alisverisCom: AlisverisComAdapter,
    private readonly ciceksepetiEv: CiceksepetiEvAdapter,
    private readonly cdon: CdonAdapter,
    private readonly ceneo: CeneoAdapter,
    private readonly chairish: ChairishAdapter,
    private readonly cimri: CimriAdapter,
    private readonly coupang: CoupangAdapter,
    private readonly coppel: CoppelAdapter,
    private readonly costcoCa: CostcoCaAdapter,
    private readonly evidea: EvideaAdapter,
    private readonly fuudy: FuudyAdapter,
    private readonly gorillas: GorillasAdapter,
    private readonly instacart: InstacartAdapter,
    private readonly instagramShop: InstagramShopAdapter,
    private readonly getirFood: GetirFoodAdapter,
    private readonly getirMarket: GetirMarketAdapter,
    private readonly koctas: KoctasAdapter,
    private readonly lidyana: LidyanaAdapter,
    private readonly lidl: LidlAdapter,
    private readonly modacruz: ModacruzAdapter,
    private readonly modanisa: ModanisaAdapter,
    private readonly boutiqaat: BoutiqaatAdapter,
    private readonly alibaba: AlibabaAdapter,
    private readonly alibabaB2b: AlibabaB2bAdapter,
    private readonly alibabaTr: AlibabaTrAdapter,
    private readonly autods: AutodsAdapter,
    private readonly autotrader: AutotraderAdapter,
    private readonly madeCom: MadeComAdapter,
    private readonly madeinchina: MadeinchinaAdapter,
    private readonly exportify: ExportifyAdapter,
    private readonly globalSources: GlobalSourcesAdapter,
    private readonly gardena: GardenaAdapter,
    private readonly g2a: G2aAdapter,
    private readonly gameflip: GameflipAdapter,
    private readonly gittigidiyor: GittigidiyorAdapter,
    private readonly gymshark: GymsharkAdapter,
    private readonly komplett: KomplettAdapter,
    private readonly kinguin: KinguinAdapter,
    private readonly kitapyurdu: KitapyurduAdapter,
    private readonly kmartAu: KmartAuAdapter,
    private readonly kilimall: KilimallAdapter,
    private readonly konga: KongaAdapter,
    private readonly dustin: DustinAdapter,
    private readonly dr: DrAdapter,
    private readonly souq: SouqAdapter,
    private readonly sportive: SportiveAdapter,
    private readonly sportiveTr: SportiveTrAdapter,
    private readonly submarino: SubmarinoAdapter,
    private readonly stockx: StockxAdapter,
    private readonly swappa: SwappaAdapter,
    private readonly street11: Street11Adapter,
    private readonly takealot: TakealotAdapter,
    private readonly spartoo: SpartooAdapter,
    private readonly enpara: EnparaAdapter,
    private readonly lazada: LazadaAdapter,
    private readonly shopee: ShopeeAdapter,
    private readonly tokopedia: TokopediaAdapter,
    private readonly targetPlus: TargetPlusAdapter,
    private readonly tedarikci: TedarikciAdapter,
    private readonly tiki: TikiAdapter,
    private readonly toptanevi: ToptaneviAdapter,
    private readonly tradeindia: TradeindiaAdapter,
    private readonly thredup: ThredupAdapter,
    private readonly tiktokShop: TiktokShopAdapter,
    private readonly tiklado: TikladoAdapter,
    private readonly trademe: TrademeAdapter,
    private readonly tradesy: TradesyAdapter,
    private readonly tazeDirekt: TazeDirektAdapter,
    private readonly meesho: MeeshoAdapter,
    private readonly powerDk: PowerDkAdapter,
    private readonly perigold: PerigoldAdapter,
    private readonly porland: PorlandAdapter,
    private readonly poshmark: PoshmarkAdapter,
    private readonly pigu: PiguAdapter,
    private readonly sefamerve: SefamerveAdapter,
    private readonly trendyolYemek: TrendyolYemekAdapter,
    private readonly vivense: VivenseAdapter,
    private readonly yargici: YargiciAdapter,
    private readonly youtubeShop: YoutubeShopAdapter,
    private readonly yemeksepeti: YemeksepetiAdapter,
    private readonly bolcom: BolcomAdapter,
    private readonly bonanza: BonanzaAdapter,
    private readonly buyukMagaza: BuyukMagazaAdapter,
    private readonly blibli: BlibliAdapter,
    private readonly bukalapak: BukalapakAdapter,
    private readonly catchAu: CatchAuAdapter,
    private readonly catawiki: CatawikiAdapter,
    private readonly decathlon: DecathlonAdapter,
    private readonly decathlonTr: DecathlonTrAdapter,
    private readonly decluttr: DecluttrAdapter,
    private readonly depop: DepopAdapter,
    private readonly dlgamer: DlgamerAdapter,
    private readonly dhgate: DhgateAdapter,
    private readonly doba: DobaAdapter,
    private readonly ec21: Ec21Adapter,
    private readonly emag: EmagAdapter,
    private readonly eneba: EnebaAdapter,
    private readonly hepsiburadaPremium: HepsiburadaPremiumAdapter,
    private readonly idealo: IdealoAdapter,
    private readonly idefix: IdefixAdapter,
    private readonly indiamart: IndiamartAdapter,
    private readonly n11Pro: N11ProAdapter,
    private readonly notino: NotinoAdapter,
    private readonly obiTr: ObiTrAdapter,
    private readonly oberlo: OberloAdapter,
    private readonly onbuy: OnbuyAdapter,
    private readonly otto: OttoAdapter,
    private readonly otoplaza: OtoplazaAdapter,
    private readonly ounass: OunassAdapter,
    private readonly pazaramaPremium: PazaramaPremiumAdapter,
    private readonly pazar365: Pazar365Adapter,
    private readonly realde: RealdeAdapter,
    private readonly reverb: ReverbAdapter,
    private readonly ripley: RipleyAdapter,
    private readonly trendyolPremium: TrendyolPremiumAdapter,
    private readonly zalando: ZalandoAdapter,
    private readonly zara: ZaraAdapter,
    private readonly zaraTr: ZaraTrAdapter,
    private readonly namshi: NamshiAdapter,
    private readonly carrefourMe: CarrefourMeAdapter,
    private readonly carrefourFr: CarrefourFrAdapter,
    private readonly casasBahia: CasasBahiaAdapter,
    private readonly casinoFr: CasinoFrAdapter,
    private readonly buldumbuldum: BuldumbuldumAdapter,
    private readonly carrefoursa: CarrefoursaAdapter,
    private readonly jdid: JdidAdapter,
    private readonly jdcom: JdcomAdapter,
    private readonly jet: JetAdapter,
    private readonly jiomart: JiomartAdapter,
    private readonly jossMain: JossMainAdapter,
    private readonly joom: JoomAdapter,
    private readonly jumia: JumiaAdapter,
    private readonly lamoda: LamodaAdapter,
    private readonly daraz: DarazAdapter,
    private readonly firstdibs: FirstdibsAdapter,
    private readonly flipkart: FlipkartAdapter,
    private readonly fnac: FnacAdapter,
    private readonly fruugo: FruugoAdapter,
    private readonly snapdeal: SnapdealAdapter,
    private readonly snapchatStore: SnapchatStoreAdapter,
    private readonly sokMarket: SokMarketAdapter,
    private readonly mydeal: MydealAdapter,
    private readonly myntra: MyntraAdapter,
    private readonly rakuten: RakutenAdapter,
    private readonly qoo10: Qoo10Adapter,
    private readonly lazadaPh: LazadaPhAdapter,
    private readonly laredoute: LaredouteAdapter,
    private readonly mercadolibre: MercadolibreAdapter,
    private readonly mercari: MercariAdapter,
    private readonly meqasa: MeqasaAdapter,
    private readonly getirYemek: GetirYemekAdapter,
    private readonly letgo: LetgoAdapter,
    private readonly logoCommerce: LogoCommerceAdapter,
    private readonly mysoft: MysoftAdapter,
    private readonly protel: ProtelAdapter,
    private readonly sahibindenB2b: SahibindenB2bAdapter,
    private readonly sahibindenPro: SahibindenProAdapter,
    private readonly sahibindenPremium: SahibindenPremiumAdapter,
    private readonly spocket: SpocketAdapter,
    private readonly sendo: SendoAdapter,
    private readonly shein: SheinAdapter,
    private readonly shopandsend: ShopandsendAdapter,
    private readonly shukran: ShukranAdapter,
    private readonly sivvi: SivviAdapter,
    private readonly sharafDg: SharafDgAdapter,
    private readonly shopiverse: ShopiverseAdapter,
    private readonly simpra: SimpraAdapter,
    private readonly shopiroll: ShopirollAdapter,
    private readonly medusa: MedusaAdapter,
    private readonly vendure: VendureAdapter,
    private readonly saleor: SaleorAdapter,
    private readonly iyzico: IyzicoAdapter,
    private readonly stripe: StripeAdapter,
    private readonly bizimMuhasebe: BizimMuhasebeAdapter,
    private readonly logoCloud: LogoCloudAdapter,
    private readonly finansMuhasebe: FinansMuhasebeAdapter,
    private readonly mikroBulut: MikroBulutAdapter,
    private readonly vinted: VintedAdapter,
    private readonly wadi: WadiAdapter,
    private readonly watsonsTr: WatsonsTrAdapter,
    private readonly whatsappCommerce: WhatsappCommerceAdapter,
    private readonly wish: WishAdapter,
    private readonly yandexMarket: YandexMarketAdapter,
    private readonly akulaku: AkulakuAdapter,
    private readonly americanas: AmericanasAdapter,
    private readonly centralOnline: CentralOnlineAdapter,
    private readonly falabella: FalabellaAdapter,
    private readonly gotoBusiness: GotoBusinessAdapter,
    private readonly gmarket: GmarketAdapter,
    private readonly grabMart: GrabMartAdapter,
    private readonly hizliresmi: HizliresmiAdapter,
    private readonly houzz: HouzzAdapter,
    private readonly harveyNorman: HarveyNormanAdapter,
    private readonly hudsonsBay: HudsonsBayAdapter,
    private readonly ikasMp: IkasMpAdapter,
    private readonly linensNThings: LinensNThingsAdapter,
    private readonly linio: LinioAdapter,
    private readonly liverpoolMx: LiverpoolMxAdapter,
    private readonly madameCoco: MadameCocoAdapter,
    private readonly magalu: MagaluAdapter,
    private readonly mallCz: MallCzAdapter,
    private readonly ticimaxMp: TicimaxMpAdapter,
    private readonly afterpay: AfterpayAdapter,
    private readonly berealShop: BerealShopAdapter,
    private readonly brands4less: Brands4lessAdapter,
    private readonly clover: CloverAdapter,
    private readonly gumroad: GumroadAdapter,
    private readonly haraj: HarajAdapter,
    private readonly klarnaMerchant: KlarnaMerchantAdapter,
    private readonly okxTr: OkxTrAdapter,
    private readonly papara: PaparaAdapter,
    private readonly paribu: ParibuAdapter,
    private readonly patreon: PatreonAdapter,
    private readonly squareOnline: SquareOnlineAdapter,
    private readonly threadsShop: ThreadsShopAdapter,
    private readonly tosla: ToslaAdapter,
    private readonly vendtek: VendtekAdapter,
    private readonly venmoBusiness: VenmoBusinessAdapter,
    private readonly xShopping: XShoppingAdapter,
    private readonly zando: ZandoAdapter,
    private readonly kakaoCommerce: KakaoCommerceAdapter,
    private readonly kogan: KoganAdapter,
    private readonly lazadaMy: LazadaMyAdapter,
    private readonly mercariJp: MercariJpAdapter,
    private readonly pgmall: PgmallAdapter,
    private readonly shopeeBr: ShopeeBrAdapter,
    private readonly shopeeSg: ShopeeSgAdapter,
    private readonly shopeeTh: ShopeeThAdapter,
    private readonly themarketNz: ThemarketNzAdapter,
    private readonly yahooAuctionsJp: YahooAuctionsJpAdapter,
    private readonly zaloraMy: ZaloraMyAdapter,
    private readonly zozotown: ZozotownAdapter,
    private readonly brandAlley: BrandAlleyAdapter,
    private readonly farfetch: FarfetchAdapter,
    private readonly grailed: GrailedAdapter,
    private readonly mytheresa: MytheresaAdapter,
    private readonly netAPorter: NetAPorterAdapter,
    private readonly privalia: PrivaliaAdapter,
    private readonly rebelle: RebelleAdapter,
    private readonly showroomprive: ShowroompriveAdapter,
    private readonly tise: TiseAdapter,
    private readonly venteExclusive: VenteExclusiveAdapter,
    private readonly vestiaire: VestiaireAdapter,
    private readonly zalandoLounge: ZalandoLoungeAdapter,
    private readonly erpAdapterRegistry: ErpAdapterRegistry,
    private readonly ecommerceAdapterRegistry: EcommerceAdapterRegistry,
  ) {
    this.adapters = new Map<string, IMarketplaceAdapter>([
      ['AMAZON_TR', amazon],
      ['AMAZON_AE', amazonAe],
      ['AMAZON_CA', amazonCa],
      ['AMAZON_DE', amazonDe],
      ['AMAZON_EU', amazonEu],
      ['AMAZON_FR', amazonFr],
      ['AMAZON_JP', amazonJp],
      ['AMAZON_UK', amazonUk],
      ['AKULAKU', akulaku],
      ['AMERICANAS', americanas],
      ['ALLEGRO', allegro],
      ['WILDBERRIES', wildberries],
      ['OZON', ozon],
      ['NOON', noon],
      ['NOON_SA', noonSa],
      ['NEWEGG', newegg],
      ['CDISCOUNT', cdiscount],
      ['KAUFLAND', kaufland],
      ['KARACA', karaca],
      ['KASPI', kaspi],
      ['KINGUIN', kinguin],
      ['KITAPYURDU', kitapyurdu],
      ['KMART_AU', kmartAu],
      ['KOCTAS', koctas],
      ['TRENDYOL', trendyol],
      ['HEPSIBURADA', hepsiburada],
      ['N11', n11],
      ['CICEKSEPETI', ciceksepeti],
      ['IDEASOFT', ideasoft],
      ['TSOFT', tsoft],
      ['TICIMAX', ticimax],
      ['PTTAVM', pttavm],
      ['PAZARAMA', pazarama],
      ['WOOCOMMERCE', woocommerce],
      ['SHOPIFY', shopify],
      ['SHOPIVERSE', shopiverse],
      ['GETIR', getir],
      ['GRATIS', gratis],
      ['BOYNER', boyner],
      ['MORHIPO', morhipo],
      ['DOLAP', dolap],
      ['EBAY', ebay],
      ['EBAY_MOTORS', ebayMotors],
      ['ETSY', etsy],
      ['EC21', ec21],
      ['EXPORTIFY', exportify],
      ['TEMU', temu],
      ['SAHIBINDEN', sahibinden],
      ['SAHIBINDEN_B2B', sahibindenB2b],
      ['SAHIBINDEN_PRO', sahibindenPro],
      ['SAHIBINDEN_PREMIUM', sahibindenPremium],
      ['SPOCKET', spocket],
      ['MIGROS', migros],
      ['MADE_COM', madeCom],
      ['MADEINCHINA', madeinchina],
      ['HEPSIEXPRESS', hepsiexpress],
      ['FLO', flo],
      ['DEFACTO', defacto],
      ['DELIVEROO', deliveroo],
      ['DOPING', doping],
      ['DR', dr],
      ['ENPARA', enpara],
      ['LCWAIKIKI', lcwaikiki],
      ['LOOKFANTASTIC', lookfantastic],
      ['LAZADA', lazada],
      ['LETGO', letgo],
      ['VATAN', vatan],
      ['MEDIAMARKT', mediamarkt],
      ['MEDIAMARKT_TR', mediamarktTr],
      ['MEESHO', meesho],
      ['TEKNOSA', teknosa],
      ['KOTON', koton],
      ['MAVI', mavi],
      ['MAGENTO', magento],
      ['OPENCART', opencart],
      ['PRESTASHOP', prestashop],
      ['PRICERUNNER', pricerunner],
      ['PINTEREST', pinterest],
      ['PINKTROTTERS', pinktrotters],
      ['FAPRIKA', faprika],
      ['UNIPOS', unipos],
      ['UBER_EATS', uberEats],
      ['UZUM', uzum],
      ['VITACOST', vitacost],
      ['AKINON', akinon],
      ['IKAS', ikas],
      ['SHOPIROLL', shopiroll],
      ['MEDUSA', medusa],
      ['VENDURE', vendure],
      ['SALEOR', saleor],
      ['IYZICO', iyzico],
      ['STRIPE', stripe],
      ['A101', a101],
      ['ABOUT_YOU', aboutYou],
      ['ASOS', asos],
      ['ARCELIK', arcelik],
      ['ARACIM', aracim],
      ['ARTICLE', article],
      ['ARSY', artsy],
      ['BACKMARKET', backmarket],
      ['BAUHAUS_TR', bauhausTr],
      ['BANABI', banabi],
      ['BIMAKILLI', bimakilli],
      ['BIM_ONLINE', bimOnline],
      ['ELEKTRA', elektra],
      ['MIGROSHEMEN', migroshemen],
      ['MIGROS_HIZLI', migrosHizli],
      ['MIINTO', miinto],
      ['MIGROS_SANAL', migrosSanal],
      ['ROBOMARKT', robomarkt],
      ['ROSSMANN_TR', rossmannTr],
      ['SHOPIGO', shopigo],
      ['SHOPBACK', shopback],
      ['SPORTIVE', sportive],
      ['SPORTIVE_TR', sportiveTr],
      ['SUBMARINO', submarino],
      ['STOCKX', stockx],
      ['SWAPPA', swappa],
      ['TRENDYOL_GO', trendyolGo],
      ['TRENDYOL_GROCERIES', trendyolGroceries],
      ['VESTEL', vestel],
      ['ADDAX', addax],
      ['ADIDAS_TR', adidasTr],
      ['ALDI', aldi],
      ['ALISVERIS_COM', alisverisCom],
      ['AWOK', awok],
      ['BIGW', bigw],
      ['BONANZA', bonanza],
      ['BUYUK_MAGAZA', buyukMagaza],
      ['BOUTIQAAT', boutiqaat],
      ['CDON', cdon],
      ['CENEO', ceneo],
      ['CHAIRISH', chairish],
      ['DUSTIN', dustin],
      ['ENGLISH_HOME', englishHome],
      ['ELLOS', ellos],
      ['HEUREKA', heureka],
      ['KOMPLETT', komplett],
      ['MUMZWORLD', mumzworld],
      ['OLX', olx],
      ['POWER_DK', powerDk],
      ['ALIBABA', alibaba],
      ['ALIBABA_B2B', alibabaB2b],
      ['ALIBABA_TR', alibabaTr],
      ['AUTODS', autods],
      ['AUTOTRADER', autotrader],
      ['CICEKSEPETI_EV', ciceksepetiEv],
      ['EVIDEA', evidea],
      ['FUUDY', fuudy],
      ['GORILLAS', gorillas],
      ['GETIR_FOOD', getirFood],
      ['GETIR_MARKET', getirMarket],
      ['GETIR_YEMEK', getirYemek],
      ['GLOBAL_SOURCES', globalSources],
      ['GARDENA', gardena],
      ['G2A', g2a],
      ['GAMEFLIP', gameflip],
      ['GITTIGIDIYOR', gittigidiyor],
      ['GYMSHARK', gymshark],
      ['INSTACART', instacart],
      ['INTERSPORT_TR', intersportTr],
      ['INSTAGRAM_SHOP', instagramShop],
      ['YOUTUBE_SHOP', youtubeShop],
      ['SNAPCHAT_STORE', snapchatStore],
      ['WHATSAPP_COMMERCE', whatsappCommerce],
      ['LIDYANA', lidyana],
      ['LIDL', lidl],
      ['MODACRUZ', modacruz],
      ['MODANISA', modanisa],
      ['PERIGOLD', perigold],
      ['PORLAND', porland],
      ['POSHMARK', poshmark],
      ['PIGU', pigu],
      ['SEFAMERVE', sefamerve],
      ['SHOPEE', shopee],
      ['TRENDYOL_YEMEK', trendyolYemek],
      ['TOKOPEDIA', tokopedia],
      ['VIVENSE', vivense],
      ['YARGICI', yargici],
      ['YEMEKSEPETI', yemeksepeti],
      ['ONBUY', onbuy],
      ['OTTO', otto],
      ['OTOPLAZA', otoplaza],
      ['OUNASS', ounass],
      ['ZALANDO', zalando],
      ['BOLCOM', bolcom],
      ['BLIBLI', blibli],
      ['BUKALAPAK', bukalapak],
      ['CATCH_AU', catchAu],
      ['CATAWIKI', catawiki],
      ['EMAG', emag],
      ['ENEBA', eneba],
      ['IDEALO', idealo],
      ['IDEFIX', idefix],
      ['INDIAMART', indiamart],
      ['REALDE', realde],
      ['REVERB', reverb],
      ['RIPLEY', ripley],
      ['ZARA', zara],
      ['ZARA_TR', zaraTr],
      ['DECATHLON', decathlon],
      ['DECATHLON_TR', decathlonTr],
      ['DECLUTTR', decluttr],
      ['DLGAMER', dlgamer],
      ['DEPOP', depop],
      ['DHGATE', dhgate],
      ['DOBA', doba],
      ['HELLOFRESH', hellofresh],
      ['IHERB', iherb],
      ['HEPSIBURADA_PREMIUM', hepsiburadaPremium],
      ['TRENDYOL_PREMIUM', trendyolPremium],
      ['PAZARAMA_PREMIUM', pazaramaPremium],
      ['PAZAR365', pazar365],
      ['N11_PRO', n11Pro],
      ['NOTINO', notino],
      ['OBI_TR', obiTr],
      ['OBERLO', oberlo],
      ['NAMSHI', namshi],
      ['CARREFOUR_ME', carrefourMe],
      ['CARREFOUR_FR', carrefourFr],
      ['CASAS_BAHIA', casasBahia],
      ['CASINO_FR', casinoFr],
      ['BULDUMBULDUM', buldumbuldum],
      ['CARREFOURSA', carrefoursa],
      ['JDID', jdid],
      ['JDCOM', jdcom],
      ['JET', jet],
      ['JIOMART', jiomart],
      ['JOSS_MAIN', jossMain],
      ['JOOM', joom],
      ['JUMIA', jumia],
      ['LAMODA', lamoda],
      ['DARAZ', daraz],
      ['FIRSTDIBS', firstdibs],
      ['FLIPKART', flipkart],
      ['SNAPDEAL', snapdeal],
      ['STREET11', street11],
      ['SOK_MARKET', sokMarket],
      ['MYDEAL', mydeal],
      ['MYNTRA', myntra],
      ['RAKUTEN', rakuten],
      ['QOO10', qoo10],
      ['LAZADA_PH', lazadaPh],
      ['MERCADOLIBRE', mercadolibre],
      ['MERCARI', mercari],
      ['MEQASA', meqasa],
      ['WALMART', walmart],
      ['TARGET_PLUS', targetPlus],
      ['TAZE_DIREKT', tazeDirekt],
      ['BESTBUY', bestbuy],
      ['WAYFAIR', wayfair],
      ['WEBMOTORS', webmotors],
      ['OVERSTOCK', overstock],
      ['FNAC', fnac],
      ['FRUUGO', fruugo],
      ['LAREDOUTE', laredoute],
      ['SPARTOO', spartoo],
      ['MANOMANO', manomano],
      ['VEEPEE', veepee],
      ['TRENDYOL_INT', trendyolInt],
      ['TRENDYOL_MILLA', trendyolMilla],
      ['TRENDYOL_SECOND_HAND', trendyolSecondHand],
      ['SENDO', sendo],
      ['SHEIN', shein],
      ['SHOPANDSEND', shopandsend],
      ['SHUKRAN', shukran],
      ['SIVVI', sivvi],
      ['TEDARIKCI', tedarikci],
      ['TIKI', tiki],
      ['TOPTANEVI', toptanevi],
      ['TRADEINDIA', tradeindia],
      ['THREDUP', thredup],
      ['TIKTOK_SHOP', tiktokShop],
      ['TIKLADO', tiklado],
      ['TRADEME', trademe],
      ['TRADESY', tradesy],
      ['YANDEX_MARKET', yandexMarket],
      ['TAKEALOT', takealot],
      ['BIRCH_LANE', birchLane],
      ['BIDORBUY', bidorbuy],
      ['KILIMALL', kilimall],
      ['KONGA', konga],
      ['SOUQ', souq],
      ['SHARAF_DG', sharafDg],
      ['VINTED', vinted],
      ['WADI', wadi],
      ['WATSONS_TR', watsonsTr],
      ['WISH', wish],
      ['OPENSOOQ', opensooq],
      ['CIMRI', cimri],
      ['COUPANG', coupang],
      ['COPPEL', coppel],
      ['COSTCO_CA', costcoCa],
      ['CULT_BEAUTY', cultBeauty],
      ['CENTRAL_ONLINE', centralOnline],
      ['FALABELLA', falabella],
      ['GOTO_BUSINESS', gotoBusiness],
      ['GMARKET', gmarket],
      ['GRAB_MART', grabMart],
      ['HIZLIRESMI', hizliresmi],
      ['HOUZZ', houzz],
      ['HARVEY_NORMAN', harveyNorman],
      ['HUDSONS_BAY', hudsonsBay],
      ['IKAS_MP', ikasMp],
      ['LINENS_N_THINGS', linensNThings],
      ['LINIO', linio],
      ['LIVERPOOL_MX', liverpoolMx],
      ['MADAME_COCO', madameCoco],
      ['MAGALU', magalu],
      ['MALL_CZ', mallCz],
      ['AFTERPAY', afterpay],
      ['BEREAL_SHOP', berealShop],
      ['BRANDS4LESS', brands4less],
      ['CLOVER', clover],
      ['GUMROAD', gumroad],
      ['HARAJ', haraj],
      ['KLARNA_MERCHANT', klarnaMerchant],
      ['OKX_TR', okxTr],
      ['PAPARA', papara],
      ['PARIBU', paribu],
      ['PATREON', patreon],
      ['SQUARE_ONLINE', squareOnline],
      ['THREADS_SHOP', threadsShop],
      ['TOSLA', tosla],
      ['VENDTEK', vendtek],
      ['VENMO_BUSINESS', venmoBusiness],
      ['X_SHOPPING', xShopping],
      ['ZANDO', zando],
      ['KAKAO_COMMERCE', kakaoCommerce],
      ['KOGAN', kogan],
      ['LAZADA_MY', lazadaMy],
      ['MERCARI_JP', mercariJp],
      ['PGMALL', pgmall],
      ['SHOPEE_BR', shopeeBr],
      ['SHOPEE_SG', shopeeSg],
      ['SHOPEE_TH', shopeeTh],
      ['THEMARKET_NZ', themarketNz],
      ['YAHOO_AUCTIONS_JP', yahooAuctionsJp],
      ['ZALORA_MY', zaloraMy],
      ['ZOZOTOWN', zozotown],
      ['FARFETCH', farfetch],
      ['NET_A_PORTER', netAPorter],
      ['MYTHERESA', mytheresa],
      ['VESTIAIRE', vestiaire],
      ['REBELLE', rebelle],
      ['ZALANDO_LOUNGE', zalandoLounge],
      ['PRIVALIA', privalia],
      ['BRAND_ALLEY', brandAlley],
      ['SHOWROOMPRIVE', showroomprive],
      ['VENTE_EXCLUSIVE', venteExclusive],
      ['GRAILED', grailed],
      ['TISE', tise],
      ['TICIMAX_MP', ticimaxMp],
    ]);
    this.erpAdapters = new Map<string, IErpAdapter>([
      ['BIZIMHESAP', bizimhesap],
      ['PARASUT', parasut],
      ['LOGO', logo],
      ['MIKRO', mikro],
      ['LUCA', luca],
      ['TSOFT', tsoftErp],
      ['TICIMAX', ticimaxErp],
      ['NETSIS', netsis],
      ['ETA', eta],
      ['ISNET', isnet],
      ['KOLAYBI', kolaybi],
      ['NEBIM', nebim],
      ['SAP_B1', sapB1],
      ['ZIRVE', zirve],
      ['MYSOFT', mysoft],
      ['PROTEL', protel],
      ['SIMPRA', simpra],
      ['LOGO_COMMERCE', logoCommerce],
      ['BIZIM_MUHASEBE', bizimMuhasebe],
      ['LOGO_CLOUD', logoCloud],
      ['FINANS_MUHASEBE', finansMuhasebe],
      ['MIKRO_BULUT', mikroBulut],
    ]);
    for (const [erpType, adapter] of this.erpAdapterRegistry.adapters) {
      this.erpAdapters.set(erpType, adapter);
    }
    this.ecommerceAdapters = new Map<string, IEcommerceAdapter>(
      this.ecommerceAdapterRegistry.adapters,
    );
  }

  get(platform: string): IMarketplaceAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new NotFoundException(`${platform} adapter bulunamadı`);
    }
    return adapter;
  }

  getEcommerce(platform: string): IEcommerceAdapter {
    const adapter = this.ecommerceAdapters.get(platform);
    if (!adapter) {
      throw new NotFoundException(`${platform} e-ticaret adapter bulunamadı`);
    }
    return adapter;
  }

  hasEcommerceAdapter(platform: string): boolean {
    return this.ecommerceAdapters.has(platform);
  }

  getErp(erpType: string): IErpAdapter {
    const adapter = this.erpAdapters.get(erpType);
    if (!adapter) {
      throw new NotFoundException(`${erpType} ERP adapter bulunamadı`);
    }
    return adapter;
  }

  hasErpAdapter(erpType: string): boolean {
    return this.erpAdapters.has(erpType);
  }
}
