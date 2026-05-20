import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

@Injectable()
export class ShopeeThAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'SHOPEE_TH',
      baseUrl: 'https://partner.shopeemobile.com/api/v2',
      loggerContext: ShopeeThAdapter.name,
      rateLimitKey: 'SHOPEE_TH',
      pathProfile: '/shop/get_shop_info',
      pathOrders: '/order/get_order_list',
      pathProducts: '/product/get_item_list',
      pathStock: '/product/update_stock',
      pathPrice: '/product/update_price',
      resolveAuth: async (creds) => {
        const partnerId = creds.partnerId?.trim() ?? creds.apiKey?.trim();
        const partnerKey = creds.partnerKey?.trim() ?? creds.apiSecret?.trim();
        if (!partnerId || !partnerKey) {
          throw new Error(
            'Shopee TH: partnerId ve partnerKey (veya apiKey/apiSecret) zorunludur',
          );
        }
        return {
          headers: {
            'Content-Type': 'application/json',
            'X-Partner-Id': partnerId,
            'X-Partner-Key': partnerKey,
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
