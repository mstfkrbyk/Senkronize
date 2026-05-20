import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class TiktokShopAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'TIKTOK_SHOP',
      baseUrl: 'https://open-api.tiktokglobalshop.com',
      loggerContext: TiktokShopAdapter.name,
      rateLimitKey: 'TIKTOK_SHOP',
      pathProfile: '/api/shop/get_authorized_shop',
      pathOrders: '/api/orders/search',
      pathProducts: '/api/products/search',
      pathStock: '/api/products/stocks/update',
      pathPrice: '/api/products/prices/update',
      resolveAuth: async (creds) => {
        const appKey = creds.appKey?.trim() ?? creds.clientId?.trim();
        const appSecret =
          creds.appSecret?.trim() ?? creds.clientSecret?.trim() ?? '';
        if (!appKey || !appSecret) {
          throw new Error(
            'TikTok Shop: appKey ve appSecret (veya clientId/clientSecret) zorunludur',
          );
        }
        let accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          const tokenUrl =
            creds.oauthTokenUrl?.trim() ??
            'https://open-api.tiktokglobalshop.com/api/v2/token/get';
          accessToken = await fetchClientCredentialsToken(
            tokenUrl,
            appKey,
            appSecret,
          );
        }
        const ts = String(Math.floor(Date.now() / 1000));
        const signPayload = `${appKey}${ts}`;
        const signature = createHmac('sha256', appSecret)
          .update(signPayload, 'utf8')
          .digest('hex');
        return {
          headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': accessToken,
            'x-tts-app-key': appKey,
            'x-tts-timestamp': ts,
            'x-tts-signature': signature,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
