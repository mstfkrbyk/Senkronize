import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class WhatsappCommerceAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'WHATSAPP_COMMERCE',
      baseUrl: 'https://graph.facebook.com/v18.0',
      loggerContext: WhatsappCommerceAdapter.name,
      rateLimitKey: 'WHATSAPP_COMMERCE',
      pathProfile: '/me',
      pathOrders: '/commerce_orders',
      pathProducts: '/product_catalog/products',
      pathStock: '/product_catalog/inventory',
      pathPrice: '/product_catalog/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error(
            'WhatsApp Business: accessToken (Meta OAuth2) zorunludur',
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
