import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class KotonAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const baseUrl = 'https://api.koton.com/marketplace/v1';
    const opts: RestStubMarketplaceOptions = {
      platform: 'KOTON',
      baseUrl,
      loggerContext: KotonAdapter.name,
      rateLimitKey: 'KOTON',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('Koton: accessToken (Bearer) zorunludur');
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
