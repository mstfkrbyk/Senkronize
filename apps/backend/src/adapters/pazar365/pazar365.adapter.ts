import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class Pazar365Adapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'PAZAR365',
      baseUrl: 'https://api.pazar365.com/v1',
      loggerContext: Pazar365Adapter.name,
      rateLimitKey: 'PAZAR365',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Pazar365: apiKey zorunludur');
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
