import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class Street11Adapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'STREET11',
      baseUrl: 'https://api.11st.co.kr/rest',
      loggerContext: Street11Adapter.name,
      rateLimitKey: 'STREET11',
      pathProfile: '/seller/info',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/products/stock',
      pathPrice: '/products/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('11Street KR: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'openapikey': apiKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
