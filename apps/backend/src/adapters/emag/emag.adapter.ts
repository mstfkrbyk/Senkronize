import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class EmagAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'EMAG',
      baseUrl: 'https://marketplace-api.emag.ro/api-3',
      loggerContext: EmagAdapter.name,
      rateLimitKey: 'EMAG',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const username = creds.username?.trim();
        const password = creds.password?.trim();
        if (!username || !password) {
          throw new Error('eMAG: username ve password zorunludur');
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
