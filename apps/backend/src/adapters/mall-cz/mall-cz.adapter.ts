import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class MallCzAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'MALL_CZ',
      baseUrl: 'https://api.mall.cz/v1',
      loggerContext: MallCzAdapter.name,
      rateLimitKey: 'MALL_CZ',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Mall.cz: apiKey zorunludur');
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
