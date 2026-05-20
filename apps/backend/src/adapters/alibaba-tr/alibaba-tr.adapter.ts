import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class AlibabaTrAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'ALIBABA_TR',
      baseUrl: 'https://gw.open.1688.com/openapi',
      loggerContext: AlibabaTrAdapter.name,
      rateLimitKey: 'ALIBABA_TR',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        const appKey = creds.appKey?.trim();
        if (!clientId || !clientSecret || !appKey) {
          throw new Error(
            'Alibaba TR: clientId, clientSecret ve appKey zorunludur',
          );
        }
        const tokenUrl =
          creds.oauthTokenUrl?.trim() ??
          'https://gw.open.1688.com/openapi/oauth/token';
        const token = await fetchClientCredentialsToken(
          tokenUrl,
          clientId,
          clientSecret,
        );
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-App-Key': appKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
