import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from '../erp-oauth2-base.adapter';

@Injectable()
export class DebitoorErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'DEBITOOR',
    label: 'Debitoor',
    defaultBaseUrl: 'https://api.debitoor.com/api',
  };
}
