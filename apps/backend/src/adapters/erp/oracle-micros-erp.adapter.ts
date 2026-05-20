import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class OracleMicrosErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'ORACLE_MICROS',
    label: 'Oracle MICROS',
    defaultBaseUrl: 'https://api.oracle.com/hospitality/v1',
  };
}
