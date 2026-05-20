import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class CasinoFrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'CASINO_FR',
      baseUrl: 'https://api.cdiscount.com/casino/v1',
      loggerContext: CasinoFrAdapter.name,
      rateLimitKey: 'CASINO_FR',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Casino FR: apiKey zorunludur');
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
