import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from '../erp-oauth2-base.adapter';

@Injectable()
export class ExactOnlineErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'EXACT_ONLINE',
    label: 'Exact Online',
    defaultBaseUrl: 'https://start.exactonline.nl/api/v1',
  };
}
