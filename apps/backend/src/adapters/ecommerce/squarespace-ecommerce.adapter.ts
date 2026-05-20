import { Injectable } from '@nestjs/common';

import {
  EcommerceOAuth2AdapterBase,
  type EcommerceOAuth2AdapterConfig,
} from './ecommerce-oauth2-base.adapter';

@Injectable()
export class SquarespaceEcommerceAdapter extends EcommerceOAuth2AdapterBase {
  readonly config: EcommerceOAuth2AdapterConfig = {
    platform: 'SQUARESPACE',
    label: 'Squarespace E-Ticaret',
    defaultBaseUrl: 'https://api.squarespace.com/1.0',
    tokenUrl: 'https://api.squarespace.com/1.0/oauth/token',
    productsPath: '/commerce/products',
    ordersPath: '/commerce/orders',
  };
}
