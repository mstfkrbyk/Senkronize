import { Injectable, NotFoundException } from '@nestjs/common';
import type { IErpAdapter, IMarketplaceAdapter } from '@senkronize/shared';

import { A101Adapter } from './a101/a101.adapter';
import { AddaxAdapter } from './addax/addax.adapter';
import { AlibabaAdapter } from './alibaba/alibaba.adapter';
import { AkinonAdapter } from './akinon/akinon.adapter';
import { AllegroAdapter } from './allegro/allegro.adapter';
import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonAeAdapter } from './amazon-ae/amazon-ae.adapter';
import { AmazonEuAdapter } from './amazon-eu/amazon-eu.adapter';
import { ArcelikAdapter } from './arcelik/arcelik.adapter';
import { BanabiAdapter } from './banabi/banabi.adapter';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BimakilliAdapter } from './bimakilli/bimakilli.adapter';
import { BolcomAdapter } from './bolcom/bolcom.adapter';
import { BoynerAdapter } from './boyner/boyner.adapter';
import { CdiscountAdapter } from './cdiscount/cdiscount.adapter';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { CiceksepetiEvAdapter } from './ciceksepeti-ev/ciceksepeti-ev.adapter';
import { DefactoAdapter } from './defacto/defacto.adapter';
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
import { FaprikaAdapter } from './faprika/faprika.adapter';
import { FloAdapter } from './flo/flo.adapter';
import { FuudyAdapter } from './fuudy/fuudy.adapter';
import { GetirFoodAdapter } from './getir-food/getir-food.adapter';
import { GetirAdapter } from './getir/getir.adapter';
import { GittigidiyorAdapter } from './gittigidiyor/gittigidiyor.adapter';
import { GratisAdapter } from './gratis/gratis.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiburadaPremiumAdapter } from './hepsiburada-premium/hepsiburada-premium.adapter';
import { HepsiexpressAdapter } from './hepsiexpress/hepsiexpress.adapter';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { IdealoAdapter } from './idealo/idealo.adapter';
import { IkasAdapter } from './ikas/ikas.adapter';
import { IsnetAdapter } from './isnet/isnet.adapter';
import { KauflandAdapter } from './kaufland/kaufland.adapter';
import { KitapyurduAdapter } from './kitapyurdu/kitapyurdu.adapter';
import { KotonAdapter } from './koton/koton.adapter';
import { KolaybiAdapter } from './kolaybi/kolaybi.adapter';
import { LcwaikikiAdapter } from './lcwaikiki/lcwaikiki.adapter';
import { LidyanaAdapter } from './lidyana/lidyana.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { LazadaAdapter } from './lazada/lazada.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MadeinchinaAdapter } from './madeinchina/madeinchina.adapter';
import { MagentoAdapter } from './magento/magento.adapter';
import { MaviAdapter } from './mavi/mavi.adapter';
import { MediamarktAdapter } from './mediamarkt/mediamarkt.adapter';
import { MeeshoAdapter } from './meesho/meesho.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MigrosAdapter } from './migros/migros.adapter';
import { MigroshemenAdapter } from './migroshemen/migroshemen.adapter';
import { ModanisaAdapter } from './modanisa/modanisa.adapter';
import { MorhipoAdapter } from './morhipo/morhipo.adapter';
import { N11Adapter } from './n11/n11.adapter';
import { N11ProAdapter } from './n11-pro/n11-pro.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { NebimAdapter } from './nebim/nebim.adapter';
import { NoonAdapter } from './noon/noon.adapter';
import { OpencartAdapter } from './opencart/opencart.adapter';
import { OttoAdapter } from './otto/otto.adapter';
import { OzonAdapter } from './ozon/ozon.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PazaramaPremiumAdapter } from './pazarama-premium/pazarama-premium.adapter';
import { PorlandAdapter } from './porland/porland.adapter';
import { PrestashopAdapter } from './prestashop/prestashop.adapter';
import { RealdeAdapter } from './realde/realde.adapter';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { RobomarktAdapter } from './robomarkt/robomarkt.adapter';
import { SapB1Adapter } from './sapb1/sapb1.adapter';
import { SahibindenAdapter } from './sahibinden/sahibinden.adapter';
import { SefamerveAdapter } from './sefamerve/sefamerve.adapter';
import { ShopeeAdapter } from './shopee/shopee.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopigoAdapter } from './shopigo/shopigo.adapter';
import { SportiveAdapter } from './sportive/sportive.adapter';
import { TeknosaAdapter } from './teknosa/teknosa.adapter';
import { TemuAdapter } from './temu/temu.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TrendyolPremiumAdapter } from './trendyol-premium/trendyol-premium.adapter';
import { TrendyolGoAdapter } from './trendyol-go/trendyol-go.adapter';
import { TrendyolYemekAdapter } from './trendyol-yemek/trendyol-yemek.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { TokopediaAdapter } from './tokopedia/tokopedia.adapter';
import { UniposAdapter } from './unipos/unipos.adapter';
import { VatanAdapter } from './vatan/vatan.adapter';
import { VestelAdapter } from './vestel/vestel.adapter';
import { VivenseAdapter } from './vivense/vivense.adapter';
import { WildberriesAdapter } from './wildberries/wildberries.adapter';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';
import { YemeksepetiAdapter } from './yemeksepeti/yemeksepeti.adapter';
import { ZalandoAdapter } from './zalando/zalando.adapter';
import { ZaraAdapter } from './zara/zara.adapter';
import { ZirveAdapter } from './zirve/zirve.adapter';

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
    private readonly mediamarkt: MediamarktAdapter,
    private readonly teknosa: TeknosaAdapter,
    private readonly koton: KotonAdapter,
    private readonly mavi: MaviAdapter,
    private readonly magento: MagentoAdapter,
    private readonly prestashop: PrestashopAdapter,
    private readonly opencart: OpencartAdapter,
    private readonly faprika: FaprikaAdapter,
    private readonly unipos: UniposAdapter,
    private readonly akinon: AkinonAdapter,
    private readonly ikas: IkasAdapter,
    private readonly a101: A101Adapter,
    private readonly arcelik: ArcelikAdapter,
    private readonly banabi: BanabiAdapter,
    private readonly bimakilli: BimakilliAdapter,
    private readonly elektra: ElektraAdapter,
    private readonly migroshemen: MigroshemenAdapter,
    private readonly robomarkt: RobomarktAdapter,
    private readonly shopigo: ShopigoAdapter,
    private readonly trendyolGo: TrendyolGoAdapter,
    private readonly vestel: VestelAdapter,
    private readonly addax: AddaxAdapter,
    private readonly ciceksepetiEv: CiceksepetiEvAdapter,
    private readonly evidea: EvideaAdapter,
    private readonly fuudy: FuudyAdapter,
    private readonly getirFood: GetirFoodAdapter,
    private readonly lidyana: LidyanaAdapter,
    private readonly modanisa: ModanisaAdapter,
    private readonly alibaba: AlibabaAdapter,
    private readonly madeinchina: MadeinchinaAdapter,
    private readonly exportify: ExportifyAdapter,
    private readonly gittigidiyor: GittigidiyorAdapter,
    private readonly kitapyurdu: KitapyurduAdapter,
    private readonly dr: DrAdapter,
    private readonly sportive: SportiveAdapter,
    private readonly enpara: EnparaAdapter,
    private readonly lazada: LazadaAdapter,
    private readonly shopee: ShopeeAdapter,
    private readonly tokopedia: TokopediaAdapter,
    private readonly meesho: MeeshoAdapter,
    private readonly porland: PorlandAdapter,
    private readonly sefamerve: SefamerveAdapter,
    private readonly trendyolYemek: TrendyolYemekAdapter,
    private readonly vivense: VivenseAdapter,
    private readonly yemeksepeti: YemeksepetiAdapter,
    private readonly bolcom: BolcomAdapter,
    private readonly decathlon: DecathlonAdapter,
    private readonly emag: EmagAdapter,
    private readonly hepsiburadaPremium: HepsiburadaPremiumAdapter,
    private readonly idealo: IdealoAdapter,
    private readonly n11Pro: N11ProAdapter,
    private readonly otto: OttoAdapter,
    private readonly pazaramaPremium: PazaramaPremiumAdapter,
    private readonly realde: RealdeAdapter,
    private readonly trendyolPremium: TrendyolPremiumAdapter,
    private readonly zalando: ZalandoAdapter,
    private readonly zara: ZaraAdapter,
    private readonly namshi: NamshiAdapter,
    private readonly carrefourMe: CarrefourMeAdapter,
    private readonly jumia: JumiaAdapter,
    private readonly daraz: DarazAdapter,
    private readonly flipkart: FlipkartAdapter,
    private readonly snapdeal: SnapdealAdapter,
    private readonly myntra: MyntraAdapter,
    private readonly rakuten: RakutenAdapter,
    private readonly qoo10: Qoo10Adapter,
    private readonly lazadaPh: LazadaPhAdapter,
    private readonly mercadolibre: MercadolibreAdapter,
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
      ['MIGROS', migros],
      ['MADEINCHINA', madeinchina],
      ['HEPSIEXPRESS', hepsiexpress],
      ['FLO', flo],
      ['DEFACTO', defacto],
      ['DR', dr],
      ['ENPARA', enpara],
      ['LCWAIKIKI', lcwaikiki],
      ['LAZADA', lazada],
      ['VATAN', vatan],
      ['MEDIAMARKT', mediamarkt],
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
      ['A101', a101],
      ['ARCELIK', arcelik],
      ['BANABI', banabi],
      ['BIMAKILLI', bimakilli],
      ['ELEKTRA', elektra],
      ['MIGROSHEMEN', migroshemen],
      ['ROBOMARKT', robomarkt],
      ['SHOPIGO', shopigo],
      ['SPORTIVE', sportive],
      ['TRENDYOL_GO', trendyolGo],
      ['VESTEL', vestel],
      ['ADDAX', addax],
      ['ALIBABA', alibaba],
      ['CICEKSEPETI_EV', ciceksepetiEv],
      ['EVIDEA', evidea],
      ['FUUDY', fuudy],
      ['GETIR_FOOD', getirFood],
      ['GITTIGIDIYOR', gittigidiyor],
      ['LIDYANA', lidyana],
      ['MODANISA', modanisa],
      ['PORLAND', porland],
      ['SEFAMERVE', sefamerve],
      ['SHOPEE', shopee],
      ['TRENDYOL_YEMEK', trendyolYemek],
      ['TOKOPEDIA', tokopedia],
      ['VIVENSE', vivense],
      ['YEMEKSEPETI', yemeksepeti],
      ['OTTO', otto],
      ['ZALANDO', zalando],
      ['BOLCOM', bolcom],
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
      ['JUMIA', jumia],
      ['DARAZ', daraz],
      ['FLIPKART', flipkart],
      ['SNAPDEAL', snapdeal],
      ['MYNTRA', myntra],
      ['RAKUTEN', rakuten],
      ['QOO10', qoo10],
      ['LAZADA_PH', lazadaPh],
      ['MERCADOLIBRE', mercadolibre],
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
    ]);
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
