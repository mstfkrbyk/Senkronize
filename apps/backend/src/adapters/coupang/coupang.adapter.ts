import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class CoupangAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'COUPANG',
      baseUrl: 'https://api-gateway.coupang.com/v2',
      loggerContext: CoupangAdapter.name,
      rateLimitKey: 'COUPANG',
      pathProfile: '/providers/seller',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/products/stock',
      pathPrice: '/products/price',
      resolveAuth: async (creds) => {
        const accessKey =
          creds.accessKey?.trim() ?? creds.apiKey?.trim() ?? '';
        const secretKey =
          creds.secretKey?.trim() ?? creds.apiSecret?.trim() ?? '';
        if (!accessKey || !secretKey) {
          throw new Error(
            'Coupang: accessKey ve secretKey (veya apiKey/apiSecret) zorunludur',
          );
        }
        const signedDate = new Date().toISOString().replace(/[-:]/g, '').slice(2, 15) + 'Z';
        const signature = createHmac('sha256', secretKey)
          .update(`${signedDate}GET/providers/seller`, 'utf8')
          .digest('hex');
        return {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
