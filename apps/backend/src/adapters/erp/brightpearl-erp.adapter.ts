import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class BrightpearlErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'BRIGHTPEARL',
    label: 'Brightpearl',
    defaultBaseUrl: 'https://api.brightpearl.com/public-api/v1',
  };
}
