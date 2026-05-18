import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class LazadaPhAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'LAZADA_PH',
      baseUrl: 'https://api.lazada.com.ph/rest',
      loggerContext: LazadaPhAdapter.name,
      rateLimitKey: 'LAZADA_PH',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const appKey = creds.appKey?.trim();
        const accessToken = creds.accessToken?.trim();
        if (!appKey || !accessToken) {
          throw new Error('Lazada PH: appKey ve accessToken zorunludur');
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
