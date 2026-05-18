import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class ModanisaAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'MODANISA',
      baseUrl: 'https://api.modanisa.com/seller/v2',
      loggerContext: ModanisaAdapter.name,
      rateLimitKey: 'MODANISA',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const sellerId = creds.sellerId?.trim();
        if (!apiKey || !sellerId) {
          throw new Error('Modanisa: apiKey ve sellerId zorunludur');
        }
        return {
          headers: {
            'X-API-Key': apiKey,
            'X-Seller-Id': sellerId,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
