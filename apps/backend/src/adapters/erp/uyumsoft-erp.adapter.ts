import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';
import { normalizeBaseUrl } from './erp-adapter.utils';

@Injectable()
export class UyumsoftErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'UYUMSOFT',
    label: 'Uyumsoft',
    defaultBaseUrl: 'https://api.uyumsoft.com/v1',
  };

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!apiKey || !apiSecret) {
      throw new Error(`${this.config.label}: apiKey ve apiSecret zorunludur`);
    }
    const base = normalizeBaseUrl(
      credentials.baseUrl?.trim() || this.config.defaultBaseUrl,
    );
    return axios.create({
      baseURL: base,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
      },
      timeout: 30_000,
    });
  }
}
