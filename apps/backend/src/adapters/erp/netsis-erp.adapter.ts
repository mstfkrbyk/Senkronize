import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class NetsisErpCloudAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'NETSIS',
    label: 'Netsis',
    defaultBaseUrl: 'https://api.netsis.com.tr/v1',
  };
}
