import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class WalmartAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'WALMART',
      baseUrl: 'https://marketplace.walmartapis.com/v3',
      loggerContext: WalmartAdapter.name,
      rateLimitKey: 'WALMART',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error('WALMART: clientId ve clientSecret zorunludur');
        }
        const tokenUrl = creds.oauthTokenUrl?.trim() ?? 'https://marketplace.walmartapis.com/v3/token';
        const token = await fetchClientCredentialsToken(
          tokenUrl,
          clientId,
          clientSecret,
        );
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
