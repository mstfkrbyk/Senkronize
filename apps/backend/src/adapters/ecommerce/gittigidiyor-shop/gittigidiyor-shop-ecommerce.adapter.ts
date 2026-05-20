import { Injectable } from '@nestjs/common';

import {
  EcommerceOAuth2AdapterBase,
  type EcommerceOAuth2AdapterConfig,
} from '../ecommerce-oauth2-base.adapter';

@Injectable()
export class GittigidiyorShopEcommerceAdapter extends EcommerceOAuth2AdapterBase {
  readonly config: EcommerceOAuth2AdapterConfig = {
    platform: 'GITTIGIDIYOR_SHOP',
    label: 'Gittigidiyor Shop E-Ticaret',
    defaultBaseUrl: 'https://api.gittigidiyor.com/shop/v1',
    tokenUrl: 'https://api.gittigidiyor.com/oauth/token',
    productsPath: '/products',
    ordersPath: '/orders',
  };
}
