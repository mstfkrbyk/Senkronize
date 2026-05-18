import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class TrendyolYemekAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TRENDYOL_YEMEK',
      baseUrl: 'https://api.trendyol.com/mealbooking-integration-service',
      loggerContext: TrendyolYemekAdapter.name,
      rateLimitKey: 'TRENDYOL_YEMEK',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const username = creds.apiKey?.trim() ?? creds.username?.trim();
        const password = creds.apiSecret?.trim() ?? creds.password?.trim();
        if (!username || !password) {
          throw new Error(
            'Trendyol Yemek: apiKey/apiSecret (Basic Auth) veya username/password zorunludur',
          );
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
