import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from '../erp-api-key-base.adapter';
import { normalizeBaseUrl } from '../erp-adapter.utils';

@Injectable()
export class AfasOnlineErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'AFAS_ONLINE',
    label: 'AFAS Online',
    defaultBaseUrl: 'https://rest.afas.online/ProfitRestServices',
    requireApiKey: false,
  };

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const token = credentials.token?.trim() ?? credentials.apiKey?.trim();
    if (!token) {
      throw new Error(`${this.config.label}: token zorunludur`);
    }
    const afasId = credentials.afasId?.trim() ?? credentials.accountId?.trim();
    const raw = credentials.baseUrl?.trim();
    const base = raw
      ? normalizeBaseUrl(raw)
      : afasId
        ? `https://${afasId}.rest.afas.online/ProfitRestServices`
        : normalizeBaseUrl(this.config.defaultBaseUrl);
    return axios.create({
      baseURL: base,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `AfasToken ${token}`,
      },
      timeout: 30_000,
    });
  }
}
