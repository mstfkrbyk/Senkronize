import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class KlarnaMerchantAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'KLARNA_MERCHANT',
      baseUrl: 'https://api.klarna.com/payments/v1',
      loggerContext: KlarnaMerchantAdapter.name,
      rateLimitKey: 'KLARNA_MERCHANT',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const secretKey = creds.secretKey?.trim();
        if (!apiKey || !secretKey) {
          throw new Error('KlarnaMerchant: apiKey ve secretKey zorunludur');
        }
        return {
          headers: { 'Content-Type': 'application/json' },
          auth: { username: apiKey, password: secretKey },
        };
      },
    };
    super(encryptionService, opts);
  }
}
