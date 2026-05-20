import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from './ecommerce-api-key-base.adapter';

@Injectable()
export class FaprikaEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'FAPRIKA',
    label: 'Faprika E-Ticaret',
    defaultBaseUrl: 'https://api.faprika.com/v2',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
