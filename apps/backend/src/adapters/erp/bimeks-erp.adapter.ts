import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class BimeksErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'BIMEKS_ERP',
    label: 'Bimeks ERP',
    defaultBaseUrl: 'https://api.bimeks.com.tr/erp/v1',
  };
}
