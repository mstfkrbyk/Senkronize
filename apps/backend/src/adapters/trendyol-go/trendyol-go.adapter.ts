import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

const TRENDYOL_GO_BASE =
  'https://go-api.trendyol.com/merchant-integration-operationl';

@Injectable()
export class TrendyolGoAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TRENDYOL_GO',
      baseUrl: TRENDYOL_GO_BASE,
      loggerContext: TrendyolGoAdapter.name,
      rateLimitKey: 'TRENDYOL_GO',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const apiSecret = creds.apiSecret?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error('Trendyol GO: apiKey ve apiSecret zorunludur');
        }
        return {
          auth: { username: apiKey, password: apiSecret },
          headers: { 'Content-Type': 'application/json' },
        };
      },
    };
    super(encryptionService, opts);
  }
}
