import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class DrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'DR',
      baseUrl: 'https://api.dr.com.tr/marketplace/v1',
      loggerContext: DrAdapter.name,
      rateLimitKey: 'DR',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error('D&R: accessToken (Bearer) zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
