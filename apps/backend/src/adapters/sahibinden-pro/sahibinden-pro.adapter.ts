import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class SahibindenProAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'SAHIBINDEN_PRO',
      baseUrl: 'https://api.sahibinden.com/v2/pro',
      loggerContext: SahibindenProAdapter.name,
      rateLimitKey: 'SAHIBINDEN_PRO',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('Sahibinden Pro: apiKey ve apiSecret zorunludur');
        }
        return {
          headers: {
            'X-Api-Key': apiKey,
            'X-Api-Secret': apiSecret,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
