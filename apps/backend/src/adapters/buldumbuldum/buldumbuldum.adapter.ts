import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class BuldumbuldumAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'BULDUMBULDUM',
      baseUrl: 'https://api.buldumbuldum.com/v1',
      loggerContext: BuldumbuldumAdapter.name,
      rateLimitKey: 'BULDUMBULDUM',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Buldumbuldum: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
