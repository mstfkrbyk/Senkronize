import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class CepteSokAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'CEPTE_SOK',
      baseUrl: 'https://api.ceptesok.com/seller/v1',
      loggerContext: CepteSokAdapter.name,
      rateLimitKey: 'CEPTE_SOK',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Cepte Şok: apiKey zorunludur');
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
