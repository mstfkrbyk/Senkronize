import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class A101Adapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'A101',
      baseUrl: 'https://marketplace.a101.com.tr/api/v1',
      loggerContext: A101Adapter.name,
      rateLimitKey: 'A101',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const merchantId = creds.merchantId?.trim();
        if (!apiKey || !merchantId) {
          throw new Error('A101 Online: apiKey ve merchantId zorunludur');
        }
        return {
          headers: {
            'X-API-Key': apiKey,
            'X-Merchant-Id': merchantId,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
