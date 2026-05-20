import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class KinguinAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'KINGUIN',
      baseUrl: 'https://gateway.kinguin.net/esa/api/v2',
      loggerContext: KinguinAdapter.name,
      rateLimitKey: 'KINGUIN',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('KINGUIN: apiKey zorunludur');
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
