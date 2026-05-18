import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class HepsiexpressAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const baseUrl = 'https://merchantapi.hepsiexpress.com/v1';
    const opts: RestStubMarketplaceOptions = {
      platform: 'HEPSIEXPRESS',
      baseUrl,
      loggerContext: HepsiexpressAdapter.name,
      rateLimitKey: 'HEPSIEXPRESS',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Hepsiexpress: apiKey zorunludur');
        }
        return {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
