import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';
import { normalizeBaseUrl } from '../ecommerce-adapter.utils';

@Injectable()
export class ReactionCommerceEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'REACTION_COMMERCE',
    label: 'Reaction Commerce E-Ticaret',
    defaultBaseUrl: 'https://example.com/graphql',
    resolveBaseUrl: (credentials) => {
      const domain = credentials.domain?.trim() ?? credentials.baseUrl?.trim() ?? '';
      if (!domain) {
        return 'https://example.com/graphql';
      }
      return normalizeBaseUrl(`${domain}/graphql`);
    },
    extraHeaders: (credentials) => {
      const apiKey = credentials.apiKey?.trim() ?? credentials.accessToken?.trim() ?? '';
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      return headers;
    },
  };
}
