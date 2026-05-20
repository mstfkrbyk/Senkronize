import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from '../erp-api-key-base.adapter';

@Injectable()
export class HoldedErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'HOLDED',
    label: 'Holded',
    defaultBaseUrl: 'https://api.holded.com/api/v1',
  };
}
