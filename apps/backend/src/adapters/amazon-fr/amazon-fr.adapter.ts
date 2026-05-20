import { Injectable } from '@nestjs/common';

import { AmazonBaseAdapter } from '../amazon/amazon-base.adapter';
import {
  AMAZON_GLOBAL_MARKETPLACE_CURRENCY,
  AMAZON_GLOBAL_MARKETPLACE_IDS,
  AMAZON_SP_AWS_REGION_EU,
  AMAZON_SP_EU_BASE_URL,
} from '../amazon/amazon.constants';

@Injectable()
export class AmazonFrAdapter extends AmazonBaseAdapter {
  constructor() {
    super({
      platform: 'AMAZON_FR',
      spBaseUrl: AMAZON_SP_EU_BASE_URL,
      marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.FR,
      defaultCurrency: AMAZON_GLOBAL_MARKETPLACE_CURRENCY[AMAZON_GLOBAL_MARKETPLACE_IDS.FR] ?? 'EUR',
      awsRegion: AMAZON_SP_AWS_REGION_EU,
      loggerContext: AmazonFrAdapter.name,
    });
  }
}
