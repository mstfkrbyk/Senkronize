import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from './erp-oauth2-base.adapter';

@Injectable()
export class LightspeedRestaurantErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'LIGHTSPEED_RESTAURANT',
    label: 'Lightspeed Restaurant',
    defaultBaseUrl: 'https://api.lightspeedhq.com/restaurant/v1',
  };
}
