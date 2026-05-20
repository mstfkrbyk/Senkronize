import { Injectable } from '@nestjs/common';

import { AmazonBaseAdapter } from '../amazon/amazon-base.adapter';
import {
  AMAZON_GLOBAL_MARKETPLACE_CURRENCY,
  AMAZON_GLOBAL_MARKETPLACE_IDS,
  AMAZON_SP_NA_BASE_URL,
} from '../amazon/amazon.constants';

@Injectable()
export class AmazonCaAdapter extends AmazonBaseAdapter {
  constructor() {
    super({
      platform: 'AMAZON_CA',
      spBaseUrl: AMAZON_SP_NA_BASE_URL,
      marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.CA,
      defaultCurrency: AMAZON_GLOBAL_MARKETPLACE_CURRENCY[AMAZON_GLOBAL_MARKETPLACE_IDS.CA] ?? 'CAD',
      loggerContext: AmazonCaAdapter.name,
    });
  }
}
