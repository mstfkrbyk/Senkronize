import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from '../erp-api-key-base.adapter';

@Injectable()
export class InflowErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'INFLOW',
    label: 'inFlow',
    defaultBaseUrl: 'https://api.inflowinventory.com/v2',
  };
}
