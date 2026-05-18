import { Injectable, NotFoundException } from '@nestjs/common';
import type { IErpAdapter, IMarketplaceAdapter } from '@senkronize/shared';

import { AmazonAdapter } from './amazon/amazon.adapter';
import { AmazonEuAdapter } from './amazon-eu/amazon-eu.adapter';
import { AllegroAdapter } from './allegro/allegro.adapter';
import { CdiscountAdapter } from './cdiscount/cdiscount.adapter';
import { KauflandAdapter } from './kaufland/kaufland.adapter';
import { NoonAdapter } from './noon/noon.adapter';
import { OzonAdapter } from './ozon/ozon.adapter';
import { WildberriesAdapter } from './wildberries/wildberries.adapter';
import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { BoynerAdapter } from './boyner/boyner.adapter';
import { CiceksepetiAdapter } from './ciceksepeti/ciceksepeti.adapter';
import { DefactoAdapter } from './defacto/defacto.adapter';
import { DolapAdapter } from './dolap/dolap.adapter';
import { EbayAdapter } from './ebay/ebay.adapter';
import { EtsyAdapter } from './etsy/etsy.adapter';
import { FloAdapter } from './flo/flo.adapter';
import { GetirAdapter } from './getir/getir.adapter';
import { GratisAdapter } from './gratis/gratis.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { HepsiexpressAdapter } from './hepsiexpress/hepsiexpress.adapter';
import { IdeasoftAdapter } from './ideasoft/ideasoft.adapter';
import { KotonAdapter } from './koton/koton.adapter';
import { LcwaikikiAdapter } from './lcwaikiki/lcwaikiki.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { MaviAdapter } from './mavi/mavi.adapter';
import { MediamarktAdapter } from './mediamarkt/mediamarkt.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { MigrosAdapter } from './migros/migros.adapter';
import { MorhipoAdapter } from './morhipo/morhipo.adapter';
import { N11Adapter } from './n11/n11.adapter';
import { NetsisAdapter } from './netsis/netsis.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { PttavmAdapter } from './pttavm/pttavm.adapter';
import { SahibindenAdapter } from './sahibinden/sahibinden.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { TeknosaAdapter } from './teknosa/teknosa.adapter';
import { TemuAdapter } from './temu/temu.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';
import { VatanAdapter } from './vatan/vatan.adapter';
import { AkinonAdapter } from './akinon/akinon.adapter';
import { FaprikaAdapter } from './faprika/faprika.adapter';
import { IkasAdapter } from './ikas/ikas.adapter';
import { MagentoAdapter } from './magento/magento.adapter';
import { OpencartAdapter } from './opencart/opencart.adapter';
import { PrestashopAdapter } from './prestashop/prestashop.adapter';
import { UniposAdapter } from './unipos/unipos.adapter';
import { WoocommerceAdapter } from './woocommerce/woocommerce.adapter';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, IMarketplaceAdapter>;
  private readonly erpAdapters: Map<string, IErpAdapter>;

  constructor(
    private readonly amazon: AmazonAdapter,
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
  ) {
    this.adapters = new Map<string, IMarketplaceAdapter>([
      ['AMAZON_TR', amazon],
      ['AMAZON_EU', amazonEu],
      ['ALLEGRO', allegro],
      ['WILDBERRIES', wildberries],
      ['OZON', ozon],
      ['NOON', noon],
      ['CDISCOUNT', cdiscount],
      ['KAUFLAND', kaufland],
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
      ['TEMU', temu],
      ['SAHIBINDEN', sahibinden],
      ['MIGROS', migros],
      ['HEPSIEXPRESS', hepsiexpress],
      ['FLO', flo],
      ['DEFACTO', defacto],
      ['LCWAIKIKI', lcwaikiki],
      ['VATAN', vatan],
      ['MEDIAMARKT', mediamarkt],
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
