import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class ReverbAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'REVERB',
      baseUrl: 'https://api.reverb.com/api',
      loggerContext: ReverbAdapter.name,
      rateLimitKey: 'REVERB',
      pathProfile: '/my/account',
      pathOrders: '/my/orders/selling/all',
      pathProducts: '/my/listings',
      pathStock: '/my/listings/stock',
      pathPrice: '/my/listings/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('Reverb: accessToken (OAuth2 Bearer) zorunludur');
        }
        return {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/hal+json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
