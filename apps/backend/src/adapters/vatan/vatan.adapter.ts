import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class VatanAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const baseUrl = 'https://marketplace-api.vatanbilgisayar.com/v1';
    const opts: RestStubMarketplaceOptions = {
      platform: 'VATAN',
      baseUrl,
      loggerContext: VatanAdapter.name,
      rateLimitKey: 'VATAN',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Vatan: apiKey zorunludur');
        }
        return {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
