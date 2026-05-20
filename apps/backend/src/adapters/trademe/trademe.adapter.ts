import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class TrademeAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TRADEME',
      baseUrl: 'https://api.trademe.co.nz/v1',
      loggerContext: TrademeAdapter.name,
      rateLimitKey: 'TRADEME',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const consumerKey = creds.consumerKey?.trim();
        const consumerSecret = creds.consumerSecret?.trim();
        const accessToken = creds.accessToken?.trim();
        const tokenSecret = creds.tokenSecret?.trim();
        if (!consumerKey || !consumerSecret || !accessToken || !tokenSecret) {
          throw new Error(
            'Trade Me: consumerKey, consumerSecret, accessToken ve tokenSecret (OAuth1) zorunludur',
          );
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `OAuth oauth_consumer_key="${consumerKey}", oauth_token="${accessToken}"`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
