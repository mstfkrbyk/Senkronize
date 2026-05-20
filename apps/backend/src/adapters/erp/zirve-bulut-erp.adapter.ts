import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class ZirveBulutErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'ZIRVE_BULUT',
    label: 'Zirve Bulut',
    defaultBaseUrl: 'https://api.zirvebulut.com.tr/v1',
  };
}
