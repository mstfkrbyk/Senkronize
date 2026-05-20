import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class ProbilErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'PROBIL',
    label: 'Probil',
    defaultBaseUrl: 'https://api.probil.com.tr/erp/v1',
  };
}
