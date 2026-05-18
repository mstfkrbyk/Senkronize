import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class LazadaAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'LAZADA',
      baseUrl: 'https://api.lazada.com.my/rest',
      loggerContext: LazadaAdapter.name,
      rateLimitKey: 'LAZADA',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const appKey = creds.appKey?.trim();
        const accessToken = creds.accessToken?.trim();
        if (!appKey || !accessToken) {
          throw new Error('Lazada: appKey ve accessToken zorunludur');
        }
        return {
          headers: { 'Content-Type': 'application/json' },
          params: {
            app_key: appKey,
            access_token: accessToken,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
