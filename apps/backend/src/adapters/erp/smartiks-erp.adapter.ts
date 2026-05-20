import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class SmartiksErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'SMARTIKS',
    label: 'Smartiks',
    defaultBaseUrl: 'https://api.smartiks.com/v2',
  };
}
