import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from './ecommerce-api-key-base.adapter';

@Injectable()
export class ShopiverseEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'SHOPIVERSE',
    label: 'Shopiverse E-Ticaret',
    defaultBaseUrl: 'https://api.shopiverse.com/v1',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
