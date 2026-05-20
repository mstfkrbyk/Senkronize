import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class NeweggAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'NEWEGG',
      baseUrl: 'https://api.newegg.com/marketplace/v2',
      loggerContext: NeweggAdapter.name,
      rateLimitKey: 'NEWEGG',
      pathProfile: '/seller/status',
      pathOrders: '/orders',
      pathProducts: '/items',
      pathStock: '/items/stock',
      pathPrice: '/items/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim() ?? '';
        const secretKey =
          creds.secretKey?.trim() ?? creds.apiSecret?.trim() ?? '';
        if (!apiKey || !secretKey) {
          throw new Error('Newegg: apiKey ve secretKey (HMAC) zorunludur');
        }
        const timestamp = new Date().toISOString();
        const signature = createHmac('sha256', secretKey)
          .update(`${apiKey}${timestamp}`, 'utf8')
          .digest('hex');
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
