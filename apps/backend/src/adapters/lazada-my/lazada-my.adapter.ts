import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class LazadaMyAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'LAZADA_MY',
      baseUrl: 'https://api.lazada.com.my/rest',
      loggerContext: LazadaMyAdapter.name,
      rateLimitKey: 'LAZADA_MY',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim() ?? creds.appKey?.trim();
        const apiSecret = creds.apiSecret?.trim() ?? creds.secretKey?.trim();
        if (!apiKey || !apiSecret) {
          throw new Error(
            'Lazada MY: apiKey ve apiSecret (veya appKey/secretKey) zorunludur',
          );
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Api-Secret': apiSecret,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
