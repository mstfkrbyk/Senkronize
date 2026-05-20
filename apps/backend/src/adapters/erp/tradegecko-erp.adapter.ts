import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class TradegeckoErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'TRADEGECKO',
    label: 'TradeGecko',
    defaultBaseUrl: 'https://api.tradegecko.com/v1',
  };
}
