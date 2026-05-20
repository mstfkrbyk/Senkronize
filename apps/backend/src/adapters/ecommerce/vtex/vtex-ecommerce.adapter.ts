import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import {
  EcommerceApiKeyAdapterBase,
  type EcommerceApiKeyAdapterConfig,
} from '../ecommerce-api-key-base.adapter';
import { normalizeBaseUrl } from '../ecommerce-adapter.utils';

@Injectable()
export class VtexEcommerceAdapter extends EcommerceApiKeyAdapterBase {
  readonly config: EcommerceApiKeyAdapterConfig = {
    platform: 'VTEX',
    label: 'VTEX E-Ticaret',
    defaultBaseUrl: 'https://account.vtexcommercestable.com.br/api',
    productsPath: '/catalog_system/pvt/products/GetProductAndSkuIds',
    ordersPath: '/oms/pvt/orders',
    resolveBaseUrl: (credentials) => {
      const account = credentials.account?.trim() ?? credentials.accountName?.trim() ?? 'account';
      return normalizeBaseUrl(`https://${account}.vtexcommercestable.com.br/api`);
    },
  };

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const account = credentials.account?.trim() ?? credentials.accountName?.trim() ?? 'account';
    const appKey = credentials.apiKey?.trim() ?? credentials.appKey?.trim() ?? '';
    const appToken = credentials.apiToken?.trim() ?? credentials.appToken?.trim() ?? '';
    return axios.create({
      baseURL: normalizeBaseUrl(`https://${account}.vtexcommercestable.com.br/api`),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-VTEX-API-AppKey': appKey,
        'X-VTEX-API-AppToken': appToken,
      },
      timeout: 30_000,
    });
  }
}
