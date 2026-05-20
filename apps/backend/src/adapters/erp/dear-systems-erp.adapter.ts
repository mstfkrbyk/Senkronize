import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';
import { normalizeBaseUrl } from './erp-adapter.utils';

@Injectable()
export class DearSystemsErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'DEAR_SYSTEMS',
    label: 'DEAR Systems',
    defaultBaseUrl: 'https://inventory.dearsystems.com/ExternalApi/v2',
  };

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    const accountId = credentials.accountId?.trim();
    if (!apiKey) {
      throw new Error(`${this.config.label}: apiKey zorunludur`);
    }
    if (!accountId) {
      throw new Error(`${this.config.label}: accountId zorunludur`);
    }
    const base = normalizeBaseUrl(
      credentials.baseUrl?.trim() || this.config.defaultBaseUrl,
    );
    return axios.create({
      baseURL: base,
      headers: {
        'Content-Type': 'application/json',
        'api-auth-accountid': accountId,
        'api-auth-applicationkey': apiKey,
      },
      timeout: 30_000,
    });
  }
}
