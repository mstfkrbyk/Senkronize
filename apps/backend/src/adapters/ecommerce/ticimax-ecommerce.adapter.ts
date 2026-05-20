import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from './ecommerce-api-key-base.adapter';

@Injectable()
export class TicimaxEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'TICIMAX',
    label: 'Ticimax E-Ticaret',
    defaultBaseUrl: 'https://api.ticimax.com/v3',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
