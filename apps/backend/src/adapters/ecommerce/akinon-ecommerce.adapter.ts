import { Injectable } from '@nestjs/common';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from './ecommerce-api-key-base.adapter';
import { normalizeBaseUrl } from './ecommerce-adapter.utils';

@Injectable()
export class AkinonEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'AKINON',
    label: 'Akinon E-Ticaret',
    defaultBaseUrl: 'https://api.akinon.com/api/v1',
    resolveBaseUrl: (credentials) => {
      const store = credentials.storeSlug?.trim() ?? credentials.storeUrl?.trim() ?? '';
      if (!store) {
        return 'https://api.akinon.com/api/v1';
      }
      const slug = store.replace(/^https?:\/\//, '').replace(/\.akinon\.com.*$/, '');
      return normalizeBaseUrl(`https://${slug}.akinon.com/api/v1`);
    },
    productsPath: '/products/',
    ordersPath: '/orders/',
    stockPath: (barcode) => `/products/${encodeURIComponent(barcode)}/stock/`,
    pricePath: (barcode) => `/products/${encodeURIComponent(barcode)}/price/`,
    extraHeaders: (credentials) => {
      const apiKey = credentials.apiKey?.trim() ?? credentials.apiToken?.trim() ?? '';
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers.Authorization = `Token ${apiKey}`;
      }
      return headers;
    },
  };
}
