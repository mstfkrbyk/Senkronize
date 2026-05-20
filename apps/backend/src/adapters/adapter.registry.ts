import { Injectable, NotFoundException } from '@nestjs/common';
import type { IErpAdapter, IMarketplaceAdapter } from '@senkronize/shared';

import { A101Adapter } from './a101/a101.adapter';
import { AboutYouAdapter } from './about-you/about-you.adapter';
import { AddaxAdapter } from './addax/addax.adapter';
import { AsosAdapter } from './asos/asos.adapter';
import { AlibabaAdapter } from './alibaba/alibaba.adapter';
import { AlibabaTrAdapter } from './alibaba-tr/alibaba-tr.adapter';
import { AkinonAdapter } from './akinon/akinon.adapter';
import { AllegroAdapter } from './allegro/allegro.adapter';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonAeAdapter } from './amazon-ae/amazon-ae.adapter';
import { AmazonEuAdapter } from './amazon-eu/amazon-eu.adapter';
import { ArcelikAdapter } from './arcelik/arcelik.adapter';
import { BanabiAdapter } from './banabi/banabi.adapter';
import { BestbuyAdapter } from './bestbuy/bestbuy.adapter';
import { BidorbuyAdapter } from './bidorbuy/bidorbuy.adapter';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BizimMuhasebeAdapter } from './bizim-muhasebe/bizim-muhasebe.adapter';
import { BimOnlineAdapter } from './bim-online/bim-online.adapter';
import { BimakilliAdapter } from './bimakilli/bimakilli.adapter';
import { BolcomAdapter } from './bolcom/bolcom.adapter';
import { BlibliAdapter } from './blibli/blibli.adapter';
import { BukalapakAdapter } from './bukalapak/bukalapak.adapter';
import { BoynerAdapter } from './boyner/boyner.adapter';
import { CatchAuAdapter } from './catch-au/catch-au.adapter';
import { CarrefoursaAdapter } from './carrefoursa/carrefoursa.adapter';
import { CarrefourMeAdapter } from './carrefour-me/carrefour-me.adapter';
import { CdiscountAdapter } from './cdiscount/cdiscount.adapter';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { CiceksepetiEvAdapter } from './ciceksepeti-ev/ciceksepeti-ev.adapter';
import { CimriAdapter } from './cimri/cimri.adapter';
import { DefactoAdapter } from './defacto/defacto.adapter';
import { DarazAdapter } from './daraz/daraz.adapter';
import { DecathlonAdapter } from './decathlon/decathlon.adapter';
import { DolapAdapter } from './dolap/dolap.adapter';
import { DrAdapter } from './dr/dr.adapter';
import { EbayAdapter } from './ebay/ebay.adapter';
import { ElektraAdapter } from './elektra/elektra.adapter';
import { EmagAdapter } from './emag/emag.adapter';
import { EnparaAdapter } from './enpara/enpara.adapter';
import { EtaAdapter } from './eta/eta.adapter';
import { EtsyAdapter } from './etsy/etsy.adapter';
import { EvideaAdapter } from './evidea/evidea.adapter';
import { ExportifyAdapter } from './exportify/exportify.adapter';
import { FinansMuhasebeAdapter } from './finans-muhasebe/finans-muhasebe.adapter';
import { FlipkartAdapter } from './flipkart/flipkart.adapter';
import { FnacAdapter } from './fnac/fnac.adapter';
import { FruugoAdapter } from './fruugo/fruugo.adapter';
import { FaprikaAdapter } from './faprika/faprika.adapter';
import { FloAdapter } from './flo/flo.adapter';
import { FuudyAdapter } from './fuudy/fuudy.adapter';
import { GetirFoodAdapter } from './getir-food/getir-food.adapter';
import { GetirMarketAdapter } from './getir-market/getir-market.adapter';
import { GetirYemekAdapter } from './getir-yemek/getir-yemek.adapter';
import { GetirAdapter } from './getir/getir.adapter';
import { GorillasAdapter } from './gorillas/gorillas.adapter';
import { GittigidiyorAdapter } from './gittigidiyor/gittigidiyor.adapter';
import { GratisAdapter } from './gratis/gratis.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumAdapter } from './hepsiburada-premium/hepsiburada-premium.adapter';
import { HepsiexpressAdapter } from './hepsiexpress/hepsiexpress.adapter';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IdealoAdapter } from './idealo/idealo.adapter';
import { InstacartAdapter } from './instacart/instacart.adapter';
import { IkasAdapter } from './ikas/ikas.adapter';
import { IsnetAdapter } from './isnet/isnet.adapter';
import { IyzicoAdapter } from './iyzico/iyzico.adapter';
import { JdidAdapter } from './jdid/jdid.adapter';
import { JoomAdapter } from './joom/joom.adapter';
import { JumiaAdapter } from './jumia/jumia.adapter';
import { LamodaAdapter } from './lamoda/lamoda.adapter';
import { KauflandAdapter } from './kaufland/kaufland.adapter';
import { KilimallAdapter } from './kilimall/kilimall.adapter';
import { KitapyurduAdapter } from './kitapyurdu/kitapyurdu.adapter';
import { KongaAdapter } from './konga/konga.adapter';
import { KoctasAdapter } from './koctas/koctas.adapter';
import { KolaybiAdapter } from './kolaybi/kolaybi.adapter';
import { KotonAdapter } from './koton/koton.adapter';
import { LcwaikikiAdapter } from './lcwaikiki/lcwaikiki.adapter';
import { LidyanaAdapter } from './lidyana/lidyana.adapter';
import { LogoCommerceAdapter } from './logo-commerce/logo-commerce.adapter';
import { LogoCloudAdapter } from './logo-cloud/logo-cloud.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { LazadaAdapter } from './lazada/lazada.adapter';
import { LazadaPhAdapter } from './lazada-ph/lazada-ph.adapter';
import { LaredouteAdapter } from './laredoute/laredoute.adapter';
import { LetgoAdapter } from './letgo/letgo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeinchinaAdapter } from './madeinchina/madeinchina.adapter';
import { MagentoAdapter } from './magento/magento.adapter';
import { MedusaAdapter } from './medusa/medusa.adapter';
import { ManomanoAdapter } from './manomano/manomano.adapter';
import { MaviAdapter } from './mavi/mavi.adapter';
import { MediamarktAdapter } from './mediamarkt/mediamarkt.adapter';
import { MediamarktTrAdapter } from './mediamarkt-tr/mediamarkt-tr.adapter';
import { MeeshoAdapter } from './meesho/meesho.adapter';
import { MercadolibreAdapter } from './mercadolibre/mercadolibre.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MikroBulutAdapter } from './mikro-bulut/mikro-bulut.adapter';
import { MigrosAdapter } from './migros/migros.adapter';
import { MigrosHizliAdapter } from './migros-hizli/migros-hizli.adapter';
import { MigrosSanalAdapter } from './migros-sanal/migros-sanal.adapter';
import { MydealAdapter } from './mydeal/mydeal.adapter';
import { MigroshemenAdapter } from './migroshemen/migroshemen.adapter';
import { MiintoAdapter } from './miinto/miinto.adapter';
import { ModanisaAdapter } from './modanisa/modanisa.adapter';
import { MorhipoAdapter } from './morhipo/morhipo.adapter';
import { MysoftAdapter } from './mysoft/mysoft.adapter';
import { MyntraAdapter } from './myntra/myntra.adapter';
import { N11Adapter } from './n11/n11.adapter';
import { N11ProAdapter } from './n11-pro/n11-pro.adapter';
import { NamshiAdapter } from './namshi/namshi.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NebimAdapter } from './nebim/nebim.adapter';
import { NoonAdapter } from './noon/noon.adapter';
import { OnbuyAdapter } from './onbuy/onbuy.adapter';
import { OpencartAdapter } from './opencart/opencart.adapter';
import { OpensooqAdapter } from './opensooq/opensooq.adapter';
import { OverstockAdapter } from './overstock/overstock.adapter';
import { OttoAdapter } from './otto/otto.adapter';
import { OzonAdapter } from './ozon/ozon.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumAdapter } from './pazarama-premium/pazarama-premium.adapter';
import { PorlandAdapter } from './porland/porland.adapter';
import { PrestashopAdapter } from './prestashop/prestashop.adapter';
import { SaleorAdapter } from './saleor/saleor.adapter';
import { ProtelAdapter } from './protel/protel.adapter';
import { Qoo10Adapter } from './qoo10/qoo10.adapter';
import { RakutenAdapter } from './rakuten/rakuten.adapter';
import { RealdeAdapter } from './realde/realde.adapter';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { RobomarktAdapter } from './robomarkt/robomarkt.adapter';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SahibindenPremiumAdapter } from './sahibinden-premium/sahibinden-premium.adapter';
import { SendoAdapter } from './sendo/sendo.adapter';
import { SheinAdapter } from './shein/shein.adapter';
import { SharafDgAdapter } from './sharaf-dg/sharaf-dg.adapter';
import { SahibindenProAdapter } from './sahibinden-pro/sahibinden-pro.adapter';
import { SahibindenAdapter } from './sahibinden/sahibinden.adapter';
import { SefamerveAdapter } from './sefamerve/sefamerve.adapter';
import { ShopeeAdapter } from './shopee/shopee.adapter';
import { SimpraAdapter } from './simpra/simpra.adapter';
import { SokMarketAdapter } from './sok-market/sok-market.adapter';
import { SnapdealAdapter } from './snapdeal/snapdeal.adapter';
import { ShopirollAdapter } from './shopiroll/shopiroll.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopiverseAdapter } from './shopiverse/shopiverse.adapter';
import { ShopigoAdapter } from './shopigo/shopigo.adapter';
import { SouqAdapter } from './souq/souq.adapter';
import { SportiveAdapter } from './sportive/sportive.adapter';
import { TakealotAdapter } from './takealot/takealot.adapter';
import { TikiAdapter } from './tiki/tiki.adapter';
import { TikladoAdapter } from './tiklado/tiklado.adapter';
import { TrademeAdapter } from './trademe/trademe.adapter';
import { StripeAdapter } from './stripe/stripe.adapter';
import { SpartooAdapter } from './spartoo/spartoo.adapter';
import { TeknosaAdapter } from './teknosa/teknosa.adapter';
import { TemuAdapter } from './temu/temu.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TrendyolPremiumAdapter } from './trendyol-premium/trendyol-premium.adapter';
import { TrendyolGoAdapter } from './trendyol-go/trendyol-go.adapter';
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
import { WayfairAdapter } from './wayfair/wayfair.adapter';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';
import { YemeksepetiAdapter } from './yemeksepeti/yemeksepeti.adapter';
import { ZalandoAdapter } from './zalando/zalando.adapter';
import { ZaraAdapter } from './zara/zara.adapter';
import { ZirveAdapter } from './zirve/zirve.adapter';
import { ErpAdapterRegistry } from './erp/erp-adapter.registry';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, IMarketplaceAdapter>;
  private readonly erpAdapters: Map<string, IErpAdapter>;

  constructor(
    private readonly amazon: AmazonAdapter,
    private readonly amazonAe: AmazonAeAdapter,
    private readonly amazonEu: AmazonEuAdapter,
    private readonly allegro: AllegroAdapter,
    private readonly wildberries: WildberriesAdapter,
    private readonly walmart: WalmartAdapter,
    private readonly wayfair: WayfairAdapter,
    private readonly ozon: OzonAdapter,
    private readonly noon: NoonAdapter,
    private readonly cdiscount: CdiscountAdapter,
    private readonly kaufland: KauflandAdapter,
    private readonly trendyol: TrendyolAdapter,
    private readonly hepsiburada: HepsiburadaAdapter,
    private readonly n11: N11Adapter,
    private readonly ciceksepeti: CiceksepetiAdapter,
    private readonly ideasoft: IdeasoftAdapter,
    private readonly bizimhesap: BizimHesapAdapter,
    private readonly parasut: ParasutAdapter,
    private readonly logo: LogoAdapter,
    private readonly mikro: MikroAdapter,
    private readonly luca: LucaAdapter,
    private readonly tsoft: TsoftAdapter,
    private readonly ticimax: TicimaxAdapter,
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
    private readonly morhipo: MorhipoAdapter,
    private readonly dolap: DolapAdapter,
    private readonly ebay: EbayAdapter,
    private readonly etsy: EtsyAdapter,
    private readonly temu: TemuAdapter,
    private readonly sahibinden: SahibindenAdapter,
    private readonly migros: MigrosAdapter,
    private readonly hepsiexpress: HepsiexpressAdapter,
    private readonly flo: FloAdapter,
    private readonly defacto: DefactoAdapter,
    private readonly lcwaikiki: LcwaikikiAdapter,
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
    private readonly opencart: OpencartAdapter,
    private readonly opensooq: OpensooqAdapter,
    private readonly overstock: OverstockAdapter,
    private readonly faprika: FaprikaAdapter,
    private readonly unipos: UniposAdapter,
    private readonly akinon: AkinonAdapter,
    private readonly ikas: IkasAdapter,
    private readonly a101: A101Adapter,
    private readonly aboutYou: AboutYouAdapter,
    private readonly asos: AsosAdapter,
    private readonly arcelik: ArcelikAdapter,
    private readonly banabi: BanabiAdapter,
    private readonly bestbuy: BestbuyAdapter,
    private readonly bidorbuy: BidorbuyAdapter,
    private readonly bimakilli: BimakilliAdapter,
    private readonly bimOnline: BimOnlineAdapter,
    private readonly elektra: ElektraAdapter,
    private readonly migroshemen: MigroshemenAdapter,
    private readonly migrosHizli: MigrosHizliAdapter,
    private readonly miinto: MiintoAdapter,
    private readonly migrosSanal: MigrosSanalAdapter,
    private readonly robomarkt: RobomarktAdapter,
    private readonly shopigo: ShopigoAdapter,
    private readonly trendyolGo: TrendyolGoAdapter,
    private readonly trendyolInt: TrendyolIntAdapter,
    private readonly trendyolMilla: TrendyolMillaAdapter,
    private readonly trendyolSecondHand: TrendyolSecondHandAdapter,
    private readonly vestel: VestelAdapter,
    private readonly addax: AddaxAdapter,
    private readonly ciceksepetiEv: CiceksepetiEvAdapter,
    private readonly cimri: CimriAdapter,
    private readonly evidea: EvideaAdapter,
    private readonly fuudy: FuudyAdapter,
    private readonly gorillas: GorillasAdapter,
    private readonly instacart: InstacartAdapter,
    private readonly getirFood: GetirFoodAdapter,
    private readonly getirMarket: GetirMarketAdapter,
    private readonly koctas: KoctasAdapter,
    private readonly lidyana: LidyanaAdapter,
    private readonly modanisa: ModanisaAdapter,
    private readonly alibaba: AlibabaAdapter,
    private readonly alibabaTr: AlibabaTrAdapter,
    private readonly madeinchina: MadeinchinaAdapter,
    private readonly exportify: ExportifyAdapter,
    private readonly gittigidiyor: GittigidiyorAdapter,
    private readonly kitapyurdu: KitapyurduAdapter,
    private readonly kilimall: KilimallAdapter,
    private readonly konga: KongaAdapter,
    private readonly dr: DrAdapter,
    private readonly souq: SouqAdapter,
    private readonly sportive: SportiveAdapter,
    private readonly takealot: TakealotAdapter,
    private readonly spartoo: SpartooAdapter,
    private readonly enpara: EnparaAdapter,
    private readonly lazada: LazadaAdapter,
    private readonly shopee: ShopeeAdapter,
    private readonly tokopedia: TokopediaAdapter,
    private readonly targetPlus: TargetPlusAdapter,
    private readonly tiki: TikiAdapter,
    private readonly tiklado: TikladoAdapter,
    private readonly trademe: TrademeAdapter,
    private readonly tazeDirekt: TazeDirektAdapter,
    private readonly meesho: MeeshoAdapter,
    private readonly porland: PorlandAdapter,
    private readonly sefamerve: SefamerveAdapter,
    private readonly trendyolYemek: TrendyolYemekAdapter,
    private readonly vivense: VivenseAdapter,
    private readonly yemeksepeti: YemeksepetiAdapter,
    private readonly bolcom: BolcomAdapter,
    private readonly blibli: BlibliAdapter,
    private readonly bukalapak: BukalapakAdapter,
    private readonly catchAu: CatchAuAdapter,
    private readonly decathlon: DecathlonAdapter,
    private readonly emag: EmagAdapter,
    private readonly hepsiburadaPremium: HepsiburadaPremiumAdapter,
    private readonly idealo: IdealoAdapter,
    private readonly n11Pro: N11ProAdapter,
    private readonly onbuy: OnbuyAdapter,
    private readonly otto: OttoAdapter,
    private readonly pazaramaPremium: PazaramaPremiumAdapter,
    private readonly realde: RealdeAdapter,
    private readonly trendyolPremium: TrendyolPremiumAdapter,
    private readonly zalando: ZalandoAdapter,
    private readonly zara: ZaraAdapter,
    private readonly namshi: NamshiAdapter,
    private readonly carrefourMe: CarrefourMeAdapter,
    private readonly carrefoursa: CarrefoursaAdapter,
    private readonly jdid: JdidAdapter,
    private readonly joom: JoomAdapter,
    private readonly jumia: JumiaAdapter,
    private readonly lamoda: LamodaAdapter,
    private readonly daraz: DarazAdapter,
    private readonly flipkart: FlipkartAdapter,
    private readonly fnac: FnacAdapter,
    private readonly fruugo: FruugoAdapter,
    private readonly snapdeal: SnapdealAdapter,
    private readonly sokMarket: SokMarketAdapter,
    private readonly mydeal: MydealAdapter,
    private readonly myntra: MyntraAdapter,
    private readonly rakuten: RakutenAdapter,
    private readonly qoo10: Qoo10Adapter,
    private readonly lazadaPh: LazadaPhAdapter,
    private readonly laredoute: LaredouteAdapter,
    private readonly mercadolibre: MercadolibreAdapter,
    private readonly getirYemek: GetirYemekAdapter,
    private readonly letgo: LetgoAdapter,
    private readonly logoCommerce: LogoCommerceAdapter,
    private readonly mysoft: MysoftAdapter,
    private readonly protel: ProtelAdapter,
    private readonly sahibindenPro: SahibindenProAdapter,
    private readonly sahibindenPremium: SahibindenPremiumAdapter,
    private readonly sendo: SendoAdapter,
    private readonly shein: SheinAdapter,
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
    private readonly wish: WishAdapter,
    private readonly yandexMarket: YandexMarketAdapter,
    private readonly erpAdapterRegistry: ErpAdapterRegistry,
  ) {
    this.adapters = new Map<string, IMarketplaceAdapter>([
      ['AMAZON_TR', amazon],
      ['AMAZON_AE', amazonAe],
      ['AMAZON_EU', amazonEu],
      ['ALLEGRO', allegro],
      ['WILDBERRIES', wildberries],
      ['OZON', ozon],
      ['NOON', noon],
      ['CDISCOUNT', cdiscount],
      ['KAUFLAND', kaufland],
      ['KITAPYURDU', kitapyurdu],
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
      ['ETSY', etsy],
      ['EXPORTIFY', exportify],
      ['TEMU', temu],
      ['SAHIBINDEN', sahibinden],
      ['SAHIBINDEN_PRO', sahibindenPro],
      ['SAHIBINDEN_PREMIUM', sahibindenPremium],
      ['MIGROS', migros],
      ['MADEINCHINA', madeinchina],
      ['HEPSIEXPRESS', hepsiexpress],
      ['FLO', flo],
      ['DEFACTO', defacto],
      ['DR', dr],
      ['ENPARA', enpara],
      ['LCWAIKIKI', lcwaikiki],
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
      ['FAPRIKA', faprika],
      ['UNIPOS', unipos],
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
      ['BANABI', banabi],
      ['BIMAKILLI', bimakilli],
      ['BIM_ONLINE', bimOnline],
      ['ELEKTRA', elektra],
      ['MIGROSHEMEN', migroshemen],
      ['MIGROS_HIZLI', migrosHizli],
      ['MIINTO', miinto],
      ['MIGROS_SANAL', migrosSanal],
      ['ROBOMARKT', robomarkt],
      ['SHOPIGO', shopigo],
      ['SPORTIVE', sportive],
      ['TRENDYOL_GO', trendyolGo],
      ['VESTEL', vestel],
      ['ADDAX', addax],
      ['ALIBABA', alibaba],
      ['ALIBABA_TR', alibabaTr],
      ['CICEKSEPETI_EV', ciceksepetiEv],
      ['EVIDEA', evidea],
      ['FUUDY', fuudy],
      ['GORILLAS', gorillas],
      ['GETIR_FOOD', getirFood],
      ['GETIR_MARKET', getirMarket],
      ['GETIR_YEMEK', getirYemek],
      ['GITTIGIDIYOR', gittigidiyor],
      ['INSTACART', instacart],
      ['LIDYANA', lidyana],
      ['MODANISA', modanisa],
      ['PORLAND', porland],
      ['SEFAMERVE', sefamerve],
      ['SHOPEE', shopee],
      ['TRENDYOL_YEMEK', trendyolYemek],
      ['TOKOPEDIA', tokopedia],
      ['VIVENSE', vivense],
      ['YEMEKSEPETI', yemeksepeti],
      ['ONBUY', onbuy],
      ['OTTO', otto],
      ['ZALANDO', zalando],
      ['BOLCOM', bolcom],
      ['BLIBLI', blibli],
      ['BUKALAPAK', bukalapak],
      ['CATCH_AU', catchAu],
      ['EMAG', emag],
      ['IDEALO', idealo],
      ['REALDE', realde],
      ['ZARA', zara],
      ['DECATHLON', decathlon],
      ['HEPSIBURADA_PREMIUM', hepsiburadaPremium],
      ['TRENDYOL_PREMIUM', trendyolPremium],
      ['PAZARAMA_PREMIUM', pazaramaPremium],
      ['N11_PRO', n11Pro],
      ['NAMSHI', namshi],
      ['CARREFOUR_ME', carrefourMe],
      ['CARREFOURSA', carrefoursa],
      ['JDID', jdid],
      ['JOOM', joom],
      ['JUMIA', jumia],
      ['LAMODA', lamoda],
      ['DARAZ', daraz],
      ['FLIPKART', flipkart],
      ['SNAPDEAL', snapdeal],
      ['SOK_MARKET', sokMarket],
      ['MYDEAL', mydeal],
      ['MYNTRA', myntra],
      ['RAKUTEN', rakuten],
      ['QOO10', qoo10],
      ['LAZADA_PH', lazadaPh],
      ['MERCADOLIBRE', mercadolibre],
      ['WALMART', walmart],
      ['TARGET_PLUS', targetPlus],
      ['TAZE_DIREKT', tazeDirekt],
      ['BESTBUY', bestbuy],
      ['WAYFAIR', wayfair],
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
      ['TIKI', tiki],
      ['TIKLADO', tiklado],
      ['TRADEME', trademe],
      ['YANDEX_MARKET', yandexMarket],
      ['TAKEALOT', takealot],
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
    ]);
    this.erpAdapters = new Map<string, IErpAdapter>([
      ['BIZIMHESAP', bizimhesap],
      ['PARASUT', parasut],
      ['LOGO', logo],
      ['MIKRO', mikro],
      ['LUCA', luca],
      ['TSOFT', tsoft],
      ['TICIMAX', ticimax],
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
  }

  get(platform: string): IMarketplaceAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new NotFoundException(`${platform} adapter bulunamadı`);
    }
    return adapter;
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
