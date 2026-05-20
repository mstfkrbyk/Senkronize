import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class AkinonErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'AKINON_ERP',
    label: 'Akinon ERP',
    defaultBaseUrl: 'https://api.akinon.com/erp/v1',
  };
}
