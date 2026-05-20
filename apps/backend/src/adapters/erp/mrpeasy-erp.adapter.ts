import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class MrpeasyErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'MRPEASY',
    label: 'MRPeasy',
    defaultBaseUrl: 'https://app.mrpeasy.com/rest/v1',
  };
}
