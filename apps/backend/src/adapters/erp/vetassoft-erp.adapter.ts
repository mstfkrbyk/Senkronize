import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class VetassoftErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'VETASSOFT',
    label: 'VetasSoft',
    defaultBaseUrl: 'https://api.vetassoft.com.tr/v1',
  };
}
