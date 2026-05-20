import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class IdeasoftErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'IDEASOFT_ERP',
    label: 'IdeaSoft ERP',
    defaultBaseUrl: 'https://api.ideasoft.com.tr/v1',
    requireApiKey: false,
  };
}
