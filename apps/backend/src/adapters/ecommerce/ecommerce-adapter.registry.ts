import { Injectable } from '@nestjs/common';
import type { IEcommerceAdapter } from '@senkronize/shared';

import { AkinonEcommerceAdapter } from './akinon-ecommerce.adapter';
import { AimeosEcommerceAdapter } from './aimeos/aimeos-ecommerce.adapter';
import { BagistoEcommerceAdapter } from './bagisto/bagisto-ecommerce.adapter';
import { CommercejsEcommerceAdapter } from './commercejs/commercejs-ecommerce.adapter';
import { CrystallizeEcommerceAdapter } from './crystallize/crystallize-ecommerce.adapter';
import { ElasticPathEcommerceAdapter } from './elastic-path/elastic-path-ecommerce.adapter';
import { EpttavmEcommerceAdapter } from './epttavm/epttavm-ecommerce.adapter';
import { FaprikaEcommerceAdapter } from './faprika-ecommerce.adapter';
import { GittigidiyorShopEcommerceAdapter } from './gittigidiyor-shop/gittigidiyor-shop-ecommerce.adapter';
import { IdeasoftEcommerceAdapter } from './ideasoft/ideasoft.adapter';
import { Magento2EcommerceAdapter } from './magento2-ecommerce.adapter';
import { NacelleEcommerceAdapter } from './nacelle/nacelle-ecommerce.adapter';
import { OpencartEcommerceAdapter } from './opencart-ecommerce.adapter';
import { PazaryoluEcommerceAdapter } from './pazaryolu/pazaryolu-ecommerce.adapter';
import { PrestashopEcommerceAdapter } from './prestashop-ecommerce.adapter';
import { ReactionCommerceEcommerceAdapter } from './reaction-commerce/reaction-commerce-ecommerce.adapter';
import { ShopifyTrEcommerceAdapter } from './shopify-tr/shopify-tr-ecommerce.adapter';
import { ShopiverseEcommerceAdapter } from './shopiverse-ecommerce.adapter';
import { SquarespaceEcommerceAdapter } from './squarespace-ecommerce.adapter';
import { TicimaxEcommerceAdapter } from './ticimax/ticimax.adapter';
import { TsoftEcommerceAdapter } from './tsoft/tsoft.adapter';
import { VtexEcommerceAdapter } from './vtex/vtex-ecommerce.adapter';
import { WixStoresEcommerceAdapter } from './wix-stores-ecommerce.adapter';
import { WoocommerceEcommerceAdapter } from './woocommerce-ecommerce.adapter';

/** E-ticaret altyapısı adaptör kaydı — 3. tur */
@Injectable()
export class EcommerceAdapterRegistry {
  readonly adapters: ReadonlyMap<string, IEcommerceAdapter>;

  constructor(
    ticimax: TicimaxEcommerceAdapter,
    ideasoft: IdeasoftEcommerceAdapter,
    tsoft: TsoftEcommerceAdapter,
    akinon: AkinonEcommerceAdapter,
    faprika: FaprikaEcommerceAdapter,
    shopiverse: ShopiverseEcommerceAdapter,
    woocommerce: WoocommerceEcommerceAdapter,
    prestashop: PrestashopEcommerceAdapter,
    opencart: OpencartEcommerceAdapter,
    magento2: Magento2EcommerceAdapter,
    squarespace: SquarespaceEcommerceAdapter,
    wixStores: WixStoresEcommerceAdapter,
    commercejs: CommercejsEcommerceAdapter,
    crystallize: CrystallizeEcommerceAdapter,
    nacelle: NacelleEcommerceAdapter,
    elasticPath: ElasticPathEcommerceAdapter,
    vtex: VtexEcommerceAdapter,
    shopifyTr: ShopifyTrEcommerceAdapter,
    pazaryolu: PazaryoluEcommerceAdapter,
    epttavm: EpttavmEcommerceAdapter,
    gittigidiyorShop: GittigidiyorShopEcommerceAdapter,
    bagisto: BagistoEcommerceAdapter,
    aimeos: AimeosEcommerceAdapter,
    reactionCommerce: ReactionCommerceEcommerceAdapter,
  ) {
    this.adapters = new Map<string, IEcommerceAdapter>([
      ['TICIMAX', ticimax],
      ['IDEASOFT', ideasoft],
      ['TSOFT', tsoft],
      ['AKINON', akinon],
      ['FAPRIKA', faprika],
      ['SHOPIVERSE', shopiverse],
      ['WOOCOMMERCE', woocommerce],
      ['PRESTASHOP', prestashop],
      ['OPENCART', opencart],
      ['MAGENTO2', magento2],
      ['SQUARESPACE', squarespace],
      ['WIX_STORES', wixStores],
      ['COMMERCEJS', commercejs],
      ['CRYSTALLIZE', crystallize],
      ['NACELLE', nacelle],
      ['ELASTIC_PATH', elasticPath],
      ['VTEX', vtex],
      ['SHOPIFY_TR', shopifyTr],
      ['PAZARYOLU', pazaryolu],
      ['EPTTAVM', epttavm],
      ['GITTIGIDIYOR_SHOP', gittigidiyorShop],
      ['BAGISTO', bagisto],
      ['AIMEOS', aimeos],
      ['REACTION_COMMERCE', reactionCommerce],
    ]);
  }

  get(platform: string): IEcommerceAdapter | undefined {
    return this.adapters.get(platform);
  }

  has(platform: string): boolean {
    return this.adapters.has(platform);
  }
}
