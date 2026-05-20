import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';
import { normalizeBaseUrl } from '../ecommerce-adapter.utils';

@Injectable()
export class AimeosEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'AIMEOS',
    label: 'Aimeos E-Ticaret',
    defaultBaseUrl: 'https://example.com/api/v1',
    resolveBaseUrl: (credentials) => {
      const domain = credentials.domain?.trim() ?? credentials.baseUrl?.trim() ?? '';
      if (!domain) {
        return 'https://example.com/api/v1';
      }
      return normalizeBaseUrl(`${domain}/api/v1`);
    },
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
