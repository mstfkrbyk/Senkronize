import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class YandexMarketAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'YANDEX_MARKET',
      baseUrl: 'https://api.partner.market.yandex.ru/v2',
      loggerContext: YandexMarketAdapter.name,
      rateLimitKey: 'YANDEX_MARKET',
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
              Authorization: `OAuth ${cached}`,
            },
          };
        }
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error(
            'Yandex Market: clientId ve clientSecret (veya accessToken) zorunludur',
          );
        }
        const tokenUrl =
          creds.oauthTokenUrl?.trim() ?? 'https://oauth.yandex.ru/token';
        const token = await fetchClientCredentialsToken(
          tokenUrl,
          clientId,
          clientSecret,
        );
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `OAuth ${token}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
