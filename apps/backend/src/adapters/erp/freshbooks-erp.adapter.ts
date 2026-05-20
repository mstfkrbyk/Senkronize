import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class FreshbooksErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'FRESHBOOKS',
    label: 'FreshBooks',
    defaultBaseUrl: 'https://api.freshbooks.com/accounting/account',
  };
}
