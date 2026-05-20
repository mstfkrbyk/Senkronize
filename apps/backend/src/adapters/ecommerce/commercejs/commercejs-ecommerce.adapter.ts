import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';

@Injectable()
export class CommercejsEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'COMMERCEJS',
    label: 'Commerce.js E-Ticaret',
    defaultBaseUrl: 'https://api.commercejs.com/v1',
    productsPath: '/products',
    ordersPath: '/orders',
    extraHeaders: (credentials) => {
      const secretKey = credentials.apiKey?.trim() ?? credentials.secretKey?.trim() ?? '';
      const headers: Record<string, string> = {};
      if (secretKey) {
        headers['X-Authorization'] = secretKey;
      }
      return headers;
    },
  };
}
