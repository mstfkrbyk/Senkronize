import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class AboutYouAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'ABOUT_YOU',
      baseUrl: 'https://api.aboutyou.com/v1',
      loggerContext: AboutYouAdapter.name,
      rateLimitKey: 'ABOUT_YOU',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const cached = creds.accessToken?.trim();
        if (cached) {
          return {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cached}`,
            },
          };
        }
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error(
            'About You: clientId ve clientSecret (veya accessToken) zorunludur',
          );
        }
        const tokenUrl =
          creds.oauthTokenUrl?.trim() ?? 'https://api.aboutyou.com/oauth/token';
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
