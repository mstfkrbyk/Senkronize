import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class UsPoloTrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'US_POLO_TR',
      baseUrl: 'https://api.uspolo.com.tr/seller/v1',
      loggerContext: UsPoloTrAdapter.name,
      rateLimitKey: 'US_POLO_TR',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('US Polo TR: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
