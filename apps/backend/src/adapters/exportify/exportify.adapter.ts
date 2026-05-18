import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class ExportifyAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'EXPORTIFY',
      baseUrl: 'https://api.exportify.com/v1',
      loggerContext: ExportifyAdapter.name,
      rateLimitKey: 'EXPORTIFY',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const accessToken = creds.accessToken?.trim();
        if (!accessToken) {
          throw new Error('Exportify: accessToken (Bearer) zorunludur');
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
