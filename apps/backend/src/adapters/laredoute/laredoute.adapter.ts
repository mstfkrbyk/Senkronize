import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class LaredouteAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'LAREDOUTE',
      baseUrl: 'https://api.laredoute.com/seller/v1',
      loggerContext: LaredouteAdapter.name,
      rateLimitKey: 'LAREDOUTE',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('La Redoute: apiKey ve apiSecret zorunludur');
        }
        return {
          auth: { username: apiKey, password: apiSecret },
          headers: { 'Content-Type': 'application/json' },
        };
      },
    };
    super(encryptionService, opts);
  }
}
