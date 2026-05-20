import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class MigrosSanalAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'MIGROS_SANAL',
      baseUrl: 'https://api.migros.com.tr/online/v2',
      loggerContext: MigrosSanalAdapter.name,
      rateLimitKey: 'MIGROS_SANAL',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        const supplierId = creds.supplierId?.trim();
        if (!apiKey || !supplierId) {
          throw new Error('Migros Sanal: apiKey ve supplierId zorunludur');
        }
        return {
          headers: {
            'X-API-Key': apiKey,
            'X-Supplier-Id': supplierId,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
