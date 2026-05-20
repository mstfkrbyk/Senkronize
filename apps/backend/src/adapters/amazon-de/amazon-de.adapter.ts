import { Injectable } from '@nestjs/common';

import { AmazonBaseAdapter } from '../amazon/amazon-base.adapter';
import {
  AMAZON_GLOBAL_MARKETPLACE_CURRENCY,
  AMAZON_GLOBAL_MARKETPLACE_IDS,
  AMAZON_SP_EU_BASE_URL,
} from '../amazon/amazon.constants';

@Injectable()
export class AmazonDeAdapter extends AmazonBaseAdapter {
  constructor() {
    super({
      platform: 'AMAZON_DE',
      spBaseUrl: AMAZON_SP_EU_BASE_URL,
      marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.DE,
      defaultCurrency: AMAZON_GLOBAL_MARKETPLACE_CURRENCY[AMAZON_GLOBAL_MARKETPLACE_IDS.DE] ?? 'EUR',
      loggerContext: AmazonDeAdapter.name,
    });
  }
}
