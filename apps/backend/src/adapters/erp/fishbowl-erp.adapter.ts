import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class FishbowlErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'FISHBOWL',
    label: 'Fishbowl',
    defaultBaseUrl: 'https://api.fishbowlinventory.com/v1',
  };
}
