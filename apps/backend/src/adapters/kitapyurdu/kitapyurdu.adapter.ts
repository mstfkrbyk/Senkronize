import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class KitapyurduAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'KITAPYURDU',
      baseUrl: 'https://api.kitapyurdu.com/seller/v2',
      loggerContext: KitapyurduAdapter.name,
      rateLimitKey: 'KITAPYURDU',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const username = creds.username?.trim();
        const password = creds.password?.trim();
        if (!username || !password) {
          throw new Error('Kitapyurdu: username ve password zorunludur');
        }
        return {
          headers: { 'Content-Type': 'application/json' },
          auth: { username, password },
        };
      },
    };
    super(encryptionService, opts);
  }
}
