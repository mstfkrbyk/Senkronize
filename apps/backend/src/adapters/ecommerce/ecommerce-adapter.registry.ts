import { Injectable } from '@nestjs/common';
import type { IEcommerceAdapter } from '@senkronize/shared';

import { AkinonEcommerceAdapter } from './akinon-ecommerce.adapter';
import { FaprikaEcommerceAdapter } from './faprika-ecommerce.adapter';
import { IdeasoftEcommerceAdapter } from './ideasoft-ecommerce.adapter';
import { Magento2EcommerceAdapter } from './magento2-ecommerce.adapter';
import { OpencartEcommerceAdapter } from './opencart-ecommerce.adapter';
import { PrestashopEcommerceAdapter } from './prestashop-ecommerce.adapter';
import { ShopiverseEcommerceAdapter } from './shopiverse-ecommerce.adapter';
import { SquarespaceEcommerceAdapter } from './squarespace-ecommerce.adapter';
import { TicimaxEcommerceAdapter } from './ticimax-ecommerce.adapter';
import { TsoftEcommerceAdapter } from './tsoft-ecommerce.adapter';
import { WixStoresEcommerceAdapter } from './wix-stores-ecommerce.adapter';
import { WoocommerceEcommerceAdapter } from './woocommerce-ecommerce.adapter';

/** E-ticaret altyapısı adaptör kaydı — 2. tur */
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
    ]);
  }

  get(platform: string): IEcommerceAdapter | undefined {
    return this.adapters.get(platform);
  }

  has(platform: string): boolean {
    return this.adapters.has(platform);
  }
}
