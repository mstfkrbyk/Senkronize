import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class MuhasebeNetErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'MUHASEBE_NET',
    label: 'Muhasebe.net',
    defaultBaseUrl: 'https://api.muhasebe.net/v1',
  };
}
