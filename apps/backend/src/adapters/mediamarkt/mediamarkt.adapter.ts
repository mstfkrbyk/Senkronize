import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class MediamarktAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const baseUrl = 'https://api.mediamarkt.com.tr/marketplace/v1';
    const opts: RestStubMarketplaceOptions = {
      platform: 'MEDIAMARKT',
      baseUrl,
      loggerContext: MediamarktAdapter.name,
      rateLimitKey: 'MEDIAMARKT',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const direct = creds.accessToken?.trim();
        if (direct) {
          return {
            headers: {
              Authorization: `Bearer ${direct}`,
              'Content-Type': 'application/json',
            },
          };
        }
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error(
            'MediaMarkt: clientId ve clientSecret (veya accessToken) zorunludur',
          );
        }
        const tokenUrl = `${baseUrl.replace(/\/$/, '')}/oauth/token`;
        const token = await fetchClientCredentialsToken(
          tokenUrl,
          clientId,
          clientSecret,
        );
        return {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
