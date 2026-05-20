import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class DrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'DR',
      baseUrl: 'https://api.dr.com.tr/seller/v1',
      loggerContext: DrAdapter.name,
      rateLimitKey: 'DR',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('D&R: apiKey ve apiSecret zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Api-Secret': apiSecret,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
