import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';

@Injectable()
export class NacelleEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'NACELLE',
    label: 'Nacelle E-Ticaret',
    defaultBaseUrl: 'https://hailfrequency.com/v3/graphql',
    extraHeaders: (credentials) => {
      const token = credentials.apiToken?.trim() ?? credentials.accessToken?.trim() ?? '';
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      return headers;
    },
  };
}
