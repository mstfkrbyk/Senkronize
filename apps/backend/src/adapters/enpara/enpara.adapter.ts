import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class EnparaAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'ENPARA',
      baseUrl: 'https://api.enparacarsi.com/v1',
      loggerContext: EnparaAdapter.name,
      rateLimitKey: 'ENPARA',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error(
            'Enpara Çarşı: accessToken (OAuth2 Bearer) zorunludur; client credentials ile alınan tokenı girin.',
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
