import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class TabbyAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TABBY',
      baseUrl: 'https://api.tabby.ai/api/v2',
      loggerContext: TabbyAdapter.name,
      rateLimitKey: 'TABBY',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const secretKey = creds.secretKey?.trim();
        if (!apiKey || !secretKey) {
          throw new Error('apiKey ve secretKey zorunludur');
        }
        return {
          headers: { 'Content-Type': 'application/json' },
          auth: { username: apiKey, password: secretKey },
        };
      },
    };
    super(encryptionService, opts);
  }
}
