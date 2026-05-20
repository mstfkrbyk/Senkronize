import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class PoshmarkAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'POSHMARK',
      baseUrl: 'https://api.poshmark.com/v1',
      loggerContext: PoshmarkAdapter.name,
      rateLimitKey: 'POSHMARK',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/listings',
      pathStock: '/listings/stock',
      pathPrice: '/listings/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim();
        if (!token) {
          throw new Error('Poshmark: accessToken (OAuth2 Bearer) zorunludur');
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
