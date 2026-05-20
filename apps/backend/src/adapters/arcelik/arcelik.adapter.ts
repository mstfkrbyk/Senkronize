import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';
import type { ArcelikTokenResponse } from './arcelik.types';

const ARCELIK_BASE = 'https://api.arcelik.com.tr/marketplace/v1';
const PATH_TOKEN = '/oauth/token';

@Injectable()
export class ArcelikAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'ARCELIK',
      baseUrl: ARCELIK_BASE,
      loggerContext: ArcelikAdapter.name,
      rateLimitKey: 'ARCELIK',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const direct = creds.accessToken?.trim();
        if (direct) {
          return {
            headers: {
              Authorization: `Bearer ${direct}`,
              'Content-Type': 'application/json',
            },
          };
        }
        const clientId = creds.clientId?.trim();
        const clientSecret = creds.clientSecret?.trim();
        if (!clientId || !clientSecret) {
          throw new Error(
            'Arçelik: clientId ve clientSecret (veya accessToken) zorunludur',
          );
        }
        const url = `${ARCELIK_BASE.replace(/\/$/, '')}${PATH_TOKEN}`;
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        });
        const { data } = await axios.post<ArcelikTokenResponse>(url, body, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15_000,
        });
        const token = typeof data.access_token === 'string' ? data.access_token : '';
        if (!token) {
          throw new Error('Arçelik: access_token alınamadı');
        }
        return {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
