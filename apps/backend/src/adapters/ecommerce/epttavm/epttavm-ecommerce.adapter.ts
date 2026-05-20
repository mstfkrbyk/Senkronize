import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';

@Injectable()
export class EpttavmEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'EPTTAVM',
    label: 'Epttavm E-Ticaret',
    defaultBaseUrl: 'https://api.epttavm.com/v1',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
