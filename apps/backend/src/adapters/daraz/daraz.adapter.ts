import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class DarazAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'DARAZ',
      baseUrl: 'https://api.daraz.pk/rest',
      loggerContext: DarazAdapter.name,
      rateLimitKey: 'DARAZ',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const appKey = creds.appKey?.trim();
        const accessToken = creds.accessToken?.trim();
        if (!appKey || !accessToken) {
          throw new Error('Daraz: appKey ve accessToken zorunludur');
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
