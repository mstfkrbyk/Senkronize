import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class SimpraPlusErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'SIMPRA_PLUS',
    label: 'Simpra Plus',
    defaultBaseUrl: 'https://api.simpra.com/v2',
  };
}
