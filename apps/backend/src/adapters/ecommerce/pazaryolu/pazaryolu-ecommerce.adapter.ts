import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';

@Injectable()
export class PazaryoluEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'PAZARYOLU',
    label: 'Pazaryolu E-Ticaret',
    defaultBaseUrl: 'https://api.pazaryolu.com/v1',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
