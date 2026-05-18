import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  RestStubMarketplaceAdapter,
  type RestStubMarketplaceOptions,
} from '../internal/rest-stub-marketplace.adapter';

const YS_OAUTH_URL = 'https://api.yemeksepeti.com/api/oauth/token';

const yemeksepetiTokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();

async function resolveYemeksepetiAuthHeaders(
  creds: Record<string, string>,
): Promise<Record<string, string>> {
  const access = creds.accessToken?.trim();
  if (access) {
    return {
      Authorization: `Bearer ${access}`,
      'Content-Type': 'application/json',
    };
  }
  const clientId = creds.clientId?.trim();
  const clientSecret = creds.clientSecret?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Yemeksepeti: accessToken veya clientId + clientSecret zorunludur',
    );
  }
  const cached = yemeksepetiTokenCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      Authorization: `Bearer ${cached.token}`,
      'Content-Type': 'application/json',
    };
  }
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const { data } = await axios.post<{
    access_token: string;
    expires_in?: number;
  }>(YS_OAUTH_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;
  yemeksepetiTokenCache.set(clientId, {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000 - 60_000,
  });
  return {
    Authorization: `Bearer ${data.access_token}`,
    'Content-Type': 'application/json',
  };
}

@Injectable()
export class YemeksepetiAdapter extends RestStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: RestStubMarketplaceOptions = {
      platform: 'YEMEKSEPETI',
      baseUrl: 'https://api.yemeksepeti.com/api',
      loggerContext: YemeksepetiAdapter.name,
      rateLimitKey: 'YEMEKSEPETI',
      pathProfile: '/merchant/me',
      pathOrders: '/orders',
      pathProducts: '/products',
      pathStock: '/inventory/stock',
      pathPrice: '/inventory/price',
      resolveAuth: async (creds) => {
        const headers = await resolveYemeksepetiAuthHeaders(creds);
        const merchantId = creds.merchantId?.trim();
        return {
          headers: {
            ...headers,
            ...(merchantId ? { 'X-Merchant-Id': merchantId } : {}),
          },
        };
      },
    };
    super(encryptionService, opts);
  }
}
