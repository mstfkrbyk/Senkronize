import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class KolaymuhasebeErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'KOLAYMUHASEBE',
    label: 'Kolaymuhasebe',
    defaultBaseUrl: 'https://api.kolaymuhasebe.com/v1',
  };
}
