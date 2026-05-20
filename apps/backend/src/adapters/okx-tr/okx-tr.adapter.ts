import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class OkxTrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'OKX_TR',
      baseUrl: 'https://www.okx.com/api/v5',
      loggerContext: OkxTrAdapter.name,
      rateLimitKey: 'OKX_TR',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const secretKey = creds.secretKey?.trim();
        const passphrase = creds.passphrase?.trim();
        if (!apiKey || !secretKey || !passphrase) {
          throw new Error(
            'OkxTr: apiKey, secretKey ve passphrase zorunludur',
          );
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'OK-ACCESS-KEY': apiKey,
            'OK-ACCESS-PASSPHRASE': passphrase,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
