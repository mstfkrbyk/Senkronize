import { Buffer } from 'node:buffer';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class RakutenAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'RAKUTEN',
      baseUrl: 'https://api.rms.rakuten.co.jp',
      loggerContext: RakutenAdapter.name,
      rateLimitKey: 'RAKUTEN',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const licenseKey = creds.licenseKey?.trim();
        const serviceSecret = creds.serviceSecret?.trim();
        if (!licenseKey || !serviceSecret) {
          throw new Error('Rakuten: licenseKey ve serviceSecret zorunludur');
        }
        const basic = Buffer.from(`${licenseKey}:${serviceSecret}`).toString('base64');
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
