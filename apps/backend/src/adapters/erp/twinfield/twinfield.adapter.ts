import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from '../erp-oauth2-base.adapter';

@Injectable()
export class TwinfieldErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'TWINFIELD',
    label: 'Twinfield',
    defaultBaseUrl: 'https://api.accounting.twinfield.com',
  };
}
