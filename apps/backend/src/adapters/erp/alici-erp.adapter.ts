import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class AliciErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'ALICI_ERP',
    label: 'Alıcı ERP',
    defaultBaseUrl: 'https://api.alici.com.tr/v1',
  };
}
