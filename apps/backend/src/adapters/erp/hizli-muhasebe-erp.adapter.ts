import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class HizliMuhasebeErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'HIZLI_MUHASEBE',
    label: 'Hızlı Muhasebe',
    defaultBaseUrl: 'https://api.hizlimuhasebe.com/v1',
  };
}
