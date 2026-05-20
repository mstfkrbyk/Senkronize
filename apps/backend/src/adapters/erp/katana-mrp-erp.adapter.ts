import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';
import { normalizeBaseUrl } from './erp-adapter.utils';

@Injectable()
export class KatanaMrpErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'KATANA_MRP',
    label: 'Katana MRP',
    defaultBaseUrl: 'https://app.katanamrp.com/v2',
  };

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    const bearerToken =
      credentials.accessToken?.trim() ??
      credentials.bearerToken?.trim() ??
      credentials.token?.trim();
    if (!apiKey) {
      throw new Error(`${this.config.label}: apiKey zorunludur`);
    }
    if (!bearerToken) {
      throw new Error(`${this.config.label}: accessToken (Bearer) zorunludur`);
    }
    const base = normalizeBaseUrl(
      credentials.baseUrl?.trim() || this.config.defaultBaseUrl,
    );
    return axios.create({
      baseURL: base,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        Authorization: `Bearer ${bearerToken}`,
      },
      timeout: 30_000,
    });
  }
}
