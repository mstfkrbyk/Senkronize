import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class OlxPlAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'OLX_PL',
      baseUrl: 'https://www.olx.pl/api/partner/v2',
      loggerContext: OlxPlAdapter.name,
      rateLimitKey: 'OLX_PL',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/listings',
      pathStock: '/listings/stock',
      pathPrice: '/listings/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('OLX PL: accessToken (OAuth2 Bearer) zorunludur');
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
