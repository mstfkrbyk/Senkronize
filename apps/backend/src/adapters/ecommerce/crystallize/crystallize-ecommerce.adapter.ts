import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';

@Injectable()
export class CrystallizeEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'CRYSTALLIZE',
    label: 'Crystallize E-Ticaret',
    defaultBaseUrl: 'https://api.crystallize.com/graphql',
    extraHeaders: (credentials) => {
      const apiKey = credentials.apiKey?.trim() ?? credentials.accessTokenId?.trim() ?? '';
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['X-Crystallize-Access-Token-Id'] = apiKey;
        headers.Authorization = `Bearer ${apiKey}`;
      }
      return headers;
    },
  };
}
