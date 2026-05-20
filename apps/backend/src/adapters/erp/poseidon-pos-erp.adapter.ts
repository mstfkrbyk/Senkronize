import { Injectable } from '@nestjs/common';

import { ApiKeyErpAdapterBase, type ApiKeyErpAdapterConfig } from './erp-api-key-base.adapter';

@Injectable()
export class PoseidonPosErpAdapter extends ApiKeyErpAdapterBase {
  readonly config: ApiKeyErpAdapterConfig = {
    erpType: 'POSEIDON_POS',
    label: 'Poseidon POS',
    defaultBaseUrl: 'https://api.poseidon.com.tr/v1',
  };
}
