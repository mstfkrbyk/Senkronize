import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class JdcomAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'JDCOM',
      baseUrl: 'https://api.jd.com/routerjson',
      loggerContext: JdcomAdapter.name,
      rateLimitKey: 'JDCOM',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const appKey = creds.appKey?.trim();
        const appSecret = creds.appSecret?.trim();
        if (!appKey || !appSecret) {
          throw new Error('JD.com: appKey ve appSecret zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-App-Key': appKey,
            'X-App-Secret': appSecret,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
