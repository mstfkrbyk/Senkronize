import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class TokopediaFlashAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TOKOPEDIA_FLASH',
      baseUrl: 'https://open-api.tokopedia.com/flash/v1',
      loggerContext: TokopediaFlashAdapter.name,
      rateLimitKey: 'TOKOPEDIA_FLASH',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error(
            'Tokopedia Flash: accessToken (OAuth2 Bearer) zorunludur',
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
