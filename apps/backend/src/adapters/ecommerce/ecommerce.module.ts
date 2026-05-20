import { Module } from '@nestjs/common';

import { AkinonEcommerceAdapter } from './akinon-ecommerce.adapter';
import { AimeosEcommerceModule } from './aimeos/aimeos.module';
import { BagistoEcommerceModule } from './bagisto/bagisto.module';
import { CommercejsEcommerceModule } from './commercejs/commercejs.module';
import { CrystallizeEcommerceModule } from './crystallize/crystallize.module';
import { EcommerceAdapterRegistry } from './ecommerce-adapter.registry';
import { ElasticPathEcommerceModule } from './elastic-path/elastic-path.module';
import { EpttavmEcommerceModule } from './epttavm/epttavm.module';
import { FaprikaEcommerceAdapter } from './faprika-ecommerce.adapter';
import { GittigidiyorShopEcommerceModule } from './gittigidiyor-shop/gittigidiyor-shop.module';
import { IdeasoftEcommerceAdapter } from './ideasoft-ecommerce.adapter';
import { Magento2EcommerceAdapter } from './magento2-ecommerce.adapter';
import { NacelleEcommerceModule } from './nacelle/nacelle.module';
import { OpencartEcommerceAdapter } from './opencart-ecommerce.adapter';
import { PazaryoluEcommerceModule } from './pazaryolu/pazaryolu.module';
import { PrestashopEcommerceAdapter } from './prestashop-ecommerce.adapter';
import { ReactionCommerceEcommerceModule } from './reaction-commerce/reaction-commerce.module';
import { ShopifyTrEcommerceModule } from './shopify-tr/shopify-tr.module';
import { ShopiverseEcommerceAdapter } from './shopiverse-ecommerce.adapter';
import { SquarespaceEcommerceAdapter } from './squarespace-ecommerce.adapter';
import { TicimaxEcommerceAdapter } from './ticimax-ecommerce.adapter';
import { TsoftEcommerceAdapter } from './tsoft-ecommerce.adapter';
import { VtexEcommerceModule } from './vtex/vtex.module';
import { WixStoresEcommerceAdapter } from './wix-stores-ecommerce.adapter';
import { WoocommerceEcommerceAdapter } from './woocommerce-ecommerce.adapter';

const legacyEcommerceAdapters = [
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

const ecommercePlatformModules = [
  CommercejsEcommerceModule,
  CrystallizeEcommerceModule,
  NacelleEcommerceModule,
  ElasticPathEcommerceModule,
  VtexEcommerceModule,
  ShopifyTrEcommerceModule,
  PazaryoluEcommerceModule,
  EpttavmEcommerceModule,
  GittigidiyorShopEcommerceModule,
  BagistoEcommerceModule,
  AimeosEcommerceModule,
  ReactionCommerceEcommerceModule,
];

@Module({
  imports: [...ecommercePlatformModules],
  providers: [...legacyEcommerceAdapters, EcommerceAdapterRegistry],
  exports: [...legacyEcommerceAdapters, ...ecommercePlatformModules, EcommerceAdapterRegistry],
})
export class EcommerceAdaptersModule {}
