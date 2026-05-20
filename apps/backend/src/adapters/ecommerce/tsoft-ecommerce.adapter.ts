import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from './ecommerce-api-key-base.adapter';

@Injectable()
export class TsoftEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'TSOFT',
    label: 'T-Soft E-Ticaret',
    defaultBaseUrl: 'https://api.t-soft.com.tr/v1',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
