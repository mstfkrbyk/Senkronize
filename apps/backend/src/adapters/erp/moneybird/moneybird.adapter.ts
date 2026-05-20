import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from '../erp-oauth2-base.adapter';

@Injectable()
export class MoneybirdErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'MONEYBIRD',
    label: 'Moneybird',
    defaultBaseUrl: 'https://moneybird.com/api/v2',
  };
}
