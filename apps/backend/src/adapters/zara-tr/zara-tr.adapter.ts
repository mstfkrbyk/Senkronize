import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class ZaraTrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'ZARA_TR',
      baseUrl: 'https://api.zara.com.tr/seller/v1',
      loggerContext: ZaraTrAdapter.name,
      rateLimitKey: 'ZARA_TR',
      pathProfile: '/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const direct = creds.accessToken?.trim();
        if (direct) {
          return {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${direct}`,
            },
          };
        }
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error(
            'Zara TR: clientId ve clientSecret (veya accessToken) zorunludur',
          );
        }
        const tokenUrl =
          creds.oauthTokenUrl?.trim() ??
          'https://api.zara.com.tr/seller/v1/oauth/token';
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
