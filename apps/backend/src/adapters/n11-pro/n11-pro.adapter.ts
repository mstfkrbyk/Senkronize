import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class N11ProAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'N11_PRO',
      baseUrl: 'https://api.n11.com/pro/v1',
      loggerContext: N11ProAdapter.name,
      rateLimitKey: 'N11_PRO',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('N11 Pro: apiKey ve apiSecret zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'appkey': apiKey,
            'appsecret': apiSecret,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
