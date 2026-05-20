import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class EtradeErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'ETRADE_ERP',
    label: 'Etrade ERP',
    defaultBaseUrl: 'https://api.etrade.com.tr/v1',
  };
}
