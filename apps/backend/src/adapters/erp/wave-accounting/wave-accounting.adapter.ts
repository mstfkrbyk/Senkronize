import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from '../erp-oauth2-base.adapter';

@Injectable()
export class WaveAccountingErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'WAVE_ACCOUNTING',
    label: 'Wave Accounting',
    defaultBaseUrl: 'https://gql.waveapps.com/graphql/public',
  };
}
