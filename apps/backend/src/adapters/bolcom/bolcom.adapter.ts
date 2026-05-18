import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { axiosWithRetry } from '../../common/utils/http-retry';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class BolcomAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'BOLCOM',
      baseUrl: 'https://api.bol.com/retailer',
      loggerContext: BolcomAdapter.name,
      rateLimitKey: 'BOLCOM',
      pathProfile: '/retailer-info',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const clientId = creds.clientId?.trim() ?? creds.apiKey?.trim();
        const clientSecret = creds.clientSecret?.trim() ?? creds.apiSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error('Bol.com: clientId (API key) ve clientSecret zorunludur');
        }
        const data = await axiosWithRetry<{ access_token?: string }>(
          {
            method: 'POST',
            url: 'https://login.bol.com/token?grant_type=client_credentials',
            auth: { username: clientId, password: clientSecret },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: 'grant_type=client_credentials',
            timeout: 15_000,
          },
          {},
        );
        const token =
          typeof data.access_token === 'string' ? data.access_token : '';
        if (!token) {
          throw new Error('Bol.com: access_token alınamadı');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.retailer.v10+json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
