import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class DopingAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'DOPING',
      baseUrl: 'https://api.dopinghafiza.com/seller/v1',
      loggerContext: DopingAdapter.name,
      rateLimitKey: 'DOPING',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Doping Hafıza: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
