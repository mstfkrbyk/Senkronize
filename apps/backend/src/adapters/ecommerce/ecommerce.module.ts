import { Module } from '@nestjs/common';

import { AkinonEcommerceAdapter } from './akinon-ecommerce.adapter';
import { EcommerceAdapterRegistry } from './ecommerce-adapter.registry';
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

const ecommerceAdapters = [
  TicimaxEcommerceAdapter,
  IdeasoftEcommerceAdapter,
  TsoftEcommerceAdapter,
  AkinonEcommerceAdapter,
  FaprikaEcommerceAdapter,
  ShopiverseEcommerceAdapter,
  WoocommerceEcommerceAdapter,
  PrestashopEcommerceAdapter,
  OpencartEcommerceAdapter,
  Magento2EcommerceAdapter,
  SquarespaceEcommerceAdapter,
  WixStoresEcommerceAdapter,
];

@Module({
  providers: [...ecommerceAdapters, EcommerceAdapterRegistry],
  exports: [...ecommerceAdapters, EcommerceAdapterRegistry],
})
export class EcommerceAdaptersModule {}
