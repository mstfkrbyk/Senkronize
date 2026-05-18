import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class TokopediaAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TOKOPEDIA',
      baseUrl: 'https://fs.tokopedia.net',
      loggerContext: TokopediaAdapter.name,
      rateLimitKey: 'TOKOPEDIA',
      pathProfile: '/v1/merchant/me',
      pathOrders: '/v1/orders',
      pathProducts: '/v1/products',
      pathStock: '/v1/inventory/stock',
      pathPrice: '/v1/inventory/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error(
            'Tokopedia: accessToken (OAuth2 client credentials Bearer) zorunludur',
          );
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
