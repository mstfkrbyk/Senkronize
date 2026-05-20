import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class DepopAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'DEPOP',
      baseUrl: 'https://api.depop.com/v2',
      loggerContext: DepopAdapter.name,
      rateLimitKey: 'DEPOP',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/products/stock',
      pathPrice: '/products/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('Depop: accessToken (OAuth2 Bearer) zorunludur');
        }
        return {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
