import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class OlxAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'OLX',
      baseUrl: 'https://api.olx.com/partner/v1',
      loggerContext: OlxAdapter.name,
      rateLimitKey: 'OLX',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/listings',
      pathStock: '/listings/stock',
      pathPrice: '/listings/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('OLX: accessToken (OAuth2 Bearer) zorunludur');
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
