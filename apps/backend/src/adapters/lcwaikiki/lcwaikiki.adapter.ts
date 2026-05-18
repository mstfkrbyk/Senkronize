import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class LcwaikikiAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const baseUrl = 'https://api.lcw.com.tr/partner/v1';
    const opts: RestStubMarketplaceOptions = {
      platform: 'LCWAIKIKI',
      baseUrl,
      loggerContext: LcwaikikiAdapter.name,
      rateLimitKey: 'LCWAIKIKI',
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
            'LC Waikiki: clientId ve clientSecret (veya accessToken) zorunludur',
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
