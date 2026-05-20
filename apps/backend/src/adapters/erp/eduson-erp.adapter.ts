import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class EdusonErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'EDUSON',
    label: 'Eduson',
    defaultBaseUrl: 'https://api.eduson.com.tr/v1',
  };
}
