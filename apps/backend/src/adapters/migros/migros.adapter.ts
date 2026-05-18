import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class MigrosAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const baseUrl = 'https://api.migros.com.tr/marketplace/v1';
    const opts: RestStubMarketplaceOptions = {
      platform: 'MIGROS',
      baseUrl,
      loggerContext: MigrosAdapter.name,
      rateLimitKey: 'MIGROS',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const merchantId = creds.merchantId?.trim();
        if (!apiKey || !merchantId) {
          throw new Error('Migros: apiKey ve merchantId zorunludur');
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
