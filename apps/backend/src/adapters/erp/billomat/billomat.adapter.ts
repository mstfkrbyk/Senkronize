import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from '../erp-api-key-base.adapter';
import { normalizeBaseUrl } from '../erp-adapter.utils';

@Injectable()
export class BillomatErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'BILLOMAT',
    label: 'Billomat',
    defaultBaseUrl: 'https://app.billomat.net/api',
  };

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const username = credentials.username?.trim();
    const raw = credentials.baseUrl?.trim();
    const base = raw
      ? normalizeBaseUrl(raw)
      : username
        ? `https://${username}.billomat.net/api`
        : normalizeBaseUrl(this.config.defaultBaseUrl);
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error(`${this.config.label}: apiKey zorunludur`);
    }
    return axios.create({
      baseURL: base,
      headers: {
        'Content-Type': 'application/json',
        'X-Billomatapikey': apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30_000,
    });
  }
}
