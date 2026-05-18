import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class YemeksepetiAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'YEMEKSEPETI',
      baseUrl: 'https://api.yemeksepeti.com/merchant/market/v1',
      loggerContext: YemeksepetiAdapter.name,
      rateLimitKey: 'YEMEKSEPETI',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const merchantId = creds.merchantId?.trim();
        if (!apiKey || !merchantId) {
          throw new Error('Yemeksepeti Market: apiKey ve merchantId zorunludur');
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
