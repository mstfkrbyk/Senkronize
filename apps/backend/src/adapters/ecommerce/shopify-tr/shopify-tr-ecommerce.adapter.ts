import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';
import { normalizeBaseUrl } from '../ecommerce-adapter.utils';

@Injectable()
export class ShopifyTrEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'SHOPIFY_TR',
    label: 'Shopify TR E-Ticaret',
    defaultBaseUrl: 'https://admin.shopify.com/store',
    resolveBaseUrl: (credentials) => {
      const store = credentials.storeUrl?.trim() ?? credentials.shopDomain?.trim() ?? '';
      const host = store.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!host) {
        return 'https://admin.shopify.com/store';
      }
      const shop = host.includes('.myshopify.com') ? host : `${host}.myshopify.com`;
      return normalizeBaseUrl(`https://${shop}/admin/api/2024-04`);
    },
    productsPath: '/products.json',
    ordersPath: '/orders.json',
    extraHeaders: (credentials) => {
      const token = credentials.accessToken?.trim() ?? credentials.apiKey?.trim() ?? '';
      const headers: Record<string, string> = {};
      if (token) {
        headers['X-Shopify-Access-Token'] = token;
      }
      return headers;
    },
  };
}
