import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class InstagramShopAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'INSTAGRAM_SHOP',
      baseUrl: 'https://graph.facebook.com/v18.0',
      loggerContext: InstagramShopAdapter.name,
      rateLimitKey: 'INSTAGRAM_SHOP',
      pathProfile: '/me',
      pathOrders: '/commerce_orders',
      pathProducts: '/product_catalog/products',
      pathStock: '/product_catalog/inventory',
      pathPrice: '/product_catalog/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error(
            'Instagram Shopping: accessToken (Meta OAuth2) zorunludur',
          );
        }
        return {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            access_token: accessToken,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
