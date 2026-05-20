import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class ParasutPlusErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'PARASUT_PLUS',
    label: 'Paraşüt Plus',
    defaultBaseUrl: 'https://api.parasut.com/v4',
  };
}
