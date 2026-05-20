import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from '../erp-api-key-base.adapter';

@Injectable()
export class SevdeskErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'SEVDESK',
    label: 'sevDesk',
    defaultBaseUrl: 'https://my.sevdesk.de/api/v1',
  };
}
