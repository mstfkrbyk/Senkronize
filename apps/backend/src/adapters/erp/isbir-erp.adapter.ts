import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class IsbirErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'ISBIR_ERP',
    label: 'İşbir ERP',
    defaultBaseUrl: 'https://api.isbir.com.tr/erp/v1',
  };
}
