import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class PorlandAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'PORLAND',
      baseUrl: 'https://api.porland.com.tr/wholesale/v1',
      loggerContext: PorlandAdapter.name,
      rateLimitKey: 'PORLAND',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const username = creds.username?.trim();
        const password = creds.password?.trim();
        if (!username || !password) {
          throw new Error('Porland: username ve password (Basic Auth) zorunludur');
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
