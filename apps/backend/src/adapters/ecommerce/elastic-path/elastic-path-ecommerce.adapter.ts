import { Injectable } from '@nestjs/common';

import {
  EcommerceOAuth2AdapterBase,
  type EcommerceOAuth2AdapterConfig,
} from '../ecommerce-oauth2-base.adapter';

@Injectable()
export class ElasticPathEcommerceAdapter extends EcommerceOAuth2AdapterBase {
  readonly config: EcommerceOAuth2AdapterConfig = {
    platform: 'ELASTIC_PATH',
    label: 'Elastic Path E-Ticaret',
    defaultBaseUrl: 'https://api.elasticpath.com/v2',
    tokenUrl: 'https://api.elasticpath.com/oauth/access_token',
    productsPath: '/catalog/products',
    ordersPath: '/orders',
  };
}
