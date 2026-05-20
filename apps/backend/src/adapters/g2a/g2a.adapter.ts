import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class G2aAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'G2A',
      baseUrl: 'https://api.g2a.com/v2',
      loggerContext: G2aAdapter.name,
      rateLimitKey: 'G2A',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('G2A: apiKey ve apiSecret zorunludur');
        }
        const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${basic}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
