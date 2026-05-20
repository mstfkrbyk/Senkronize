import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class OttoplusAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'OTTOPLUS',
      baseUrl: 'https://api.ottoplus.com.tr/v1',
      loggerContext: OttoplusAdapter.name,
      rateLimitKey: 'OTTOPLUS',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Ottoplus: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
