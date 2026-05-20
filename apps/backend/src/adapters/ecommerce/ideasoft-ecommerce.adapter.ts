import { Injectable } from '@nestjs/common';

import {
  EcommerceOAuth2AdapterBase,
  type EcommerceOAuth2AdapterConfig,
} from './ecommerce-oauth2-base.adapter';

@Injectable()
export class IdeasoftEcommerceAdapter extends EcommerceOAuth2AdapterBase {
  readonly config: EcommerceOAuth2AdapterConfig = {
    platform: 'IDEASOFT',
    label: 'IdeaSoft E-Ticaret',
    defaultBaseUrl: 'https://api.ideasoft.com.tr/v3',
    tokenUrl: 'https://api.ideasoft.com.tr/v3/oauth/token',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
