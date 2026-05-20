import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class AlibabaB2bAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const pathProfile = '/me';
    const opts: RestStubMarketplaceOptions = {
      platform: 'ALIBABA_B2B',
      baseUrl: 'https://gw.open.1688.com',
      loggerContext: AlibabaB2bAdapter.name,
      rateLimitKey: 'ALIBABA_B2B',
      pathProfile,
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim() ?? '';
        const apiSecret = creds.apiSecret?.trim() ?? '';
        if (!apiKey || !apiSecret) {
          throw new Error('Alibaba B2B: apiKey ve apiSecret zorunludur');
        }
        const signedDate = new Date().toISOString().replace(/[-:]/g, '').slice(2, 15) + 'Z';
        const signature = createHmac('sha256', apiSecret)
          .update(`${signedDate}GET${pathProfile}`, 'utf8')
          .digest('hex');
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Signature': signature,
            'X-Signed-Date': signedDate,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
