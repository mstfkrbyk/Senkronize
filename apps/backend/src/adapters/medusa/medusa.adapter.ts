import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

const MEDUSA_DEFAULT_BASE = 'http://localhost:9000/store';

@Injectable()
export class MedusaAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'MEDUSA',
      baseUrl: MEDUSA_DEFAULT_BASE,
      resolveBaseUrl: (creds) =>
        creds.baseUrl?.trim() || MEDUSA_DEFAULT_BASE,
      loggerContext: MedusaAdapter.name,
      rateLimitKey: 'MEDUSA',
      pathProfile: '/auth',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/products/variants/stock',
      pathPrice: '/products/variants/price',
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim() ?? creds.apiKey?.trim();
        if (!token) {
          throw new Error('Medusa: accessToken veya apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
