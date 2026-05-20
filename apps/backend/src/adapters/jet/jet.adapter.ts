import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class JetAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'JET',
      baseUrl: 'https://merchant-api.jet.com/api',
      loggerContext: JetAdapter.name,
      rateLimitKey: 'JET',
      pathProfile: '/merchant/profile',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('Jet.com: accessToken (OAuth2 Bearer) zorunludur');
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
