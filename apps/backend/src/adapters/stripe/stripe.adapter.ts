import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class StripeAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'STRIPE',
      baseUrl: 'https://api.stripe.com/v1',
      loggerContext: StripeAdapter.name,
      rateLimitKey: 'STRIPE',
      pathProfile: '/balance',
      pathOrders: '/payment_intents',
      pathProducts: '/products',
      pathStock: '/products',
      pathPrice: '/products',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim() ?? creds.secretKey?.trim();
        if (!apiKey) {
          throw new Error('Stripe: apiKey zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
