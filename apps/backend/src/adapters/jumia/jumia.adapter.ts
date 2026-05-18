import { Buffer } from 'node:buffer';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class JumiaAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'JUMIA',
      baseUrl: 'https://api.jumia.com/v1',
      loggerContext: JumiaAdapter.name,
      rateLimitKey: 'JUMIA',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('Jumia: apiKey ve apiSecret zorunludur');
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
