import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class StockxAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'STOCKX',
      baseUrl: 'https://gateway.stockx.com/api/v2',
      loggerContext: StockxAdapter.name,
      rateLimitKey: 'STOCKX',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const bearer = creds.accessToken?.trim();
        if (!apiKey || !bearer) {
          throw new Error('StockX: apiKey ve accessToken (Bearer) zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            Authorization: `Bearer ${bearer}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
