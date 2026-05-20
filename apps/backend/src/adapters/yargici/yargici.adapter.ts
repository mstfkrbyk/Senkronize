import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class YargiciAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'YARGICI',
      baseUrl: 'https://api.yargici.com/seller/v1',
      loggerContext: YargiciAdapter.name,
      rateLimitKey: 'YARGICI',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Yargıcı: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
