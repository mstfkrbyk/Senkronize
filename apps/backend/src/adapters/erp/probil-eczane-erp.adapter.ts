import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class ProbilEczaneErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'PROBIL_ECZANE',
    label: 'Probil Eczane',
    defaultBaseUrl: 'https://api.probil.com.tr/eczane/v1',
  };
}
