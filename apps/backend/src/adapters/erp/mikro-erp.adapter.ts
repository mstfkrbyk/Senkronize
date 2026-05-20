import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class MikroErpCloudAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'MIKRO_ERP',
    label: 'Mikro ERP',
    defaultBaseUrl: 'https://api.mikroerp.com.tr/v1',
  };
}
