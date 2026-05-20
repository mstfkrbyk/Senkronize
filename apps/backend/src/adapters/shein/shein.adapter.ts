import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class SheinAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'SHEIN',
      baseUrl: 'https://openapi.shein.com/v1',
      loggerContext: SheinAdapter.name,
      rateLimitKey: 'SHEIN',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const secretKey =
          creds.secretKey?.trim() ?? creds.apiSecret?.trim() ?? '';
        if (!apiKey || !secretKey) {
          throw new Error('Shein: apiKey ve secretKey (veya apiSecret) zorunludur');
        }
        const ts = String(Date.now());
        const signature = createHmac('sha256', secretKey)
          .update(`${apiKey}${ts}`)
          .digest('hex');
        return {
          headers: {
            'Content-Type': 'application/json',
            'x-lt-openKeyId': apiKey,
            'x-lt-timestamp': ts,
            'x-lt-signature': signature,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
