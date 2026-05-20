import { Injectable } from '@nestjs/common';

import {
  EcommerceOAuth2AdapterBase,
  type EcommerceOAuth2AdapterConfig,
} from './ecommerce-oauth2-base.adapter';

@Injectable()
export class WixStoresEcommerceAdapter extends EcommerceOAuth2AdapterBase {
  readonly config: EcommerceOAuth2AdapterConfig = {
    platform: 'WIX_STORES',
    label: 'Wix Stores E-Ticaret',
    defaultBaseUrl: 'https://www.wixapis.com/stores/v1',
    productsPath: '/products/query',
    ordersPath: '/orders/query',
  };
}
