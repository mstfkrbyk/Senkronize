import { createHmac } from 'node:crypto';

import axios from 'axios';

import { isRecord } from '../stub-helpers';

const SHOPEE_BASE = 'https://partner.shopeemobile.com';

export interface ShopeeOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export function shopeePublicSign(
  partnerKey: string,
  partnerId: string,
  path: string,
  timestamp: number,
): string {
  const base = `${partnerId}${path}${timestamp}`;
  return createHmac('sha256', partnerKey).update(base, 'utf8').digest('hex');
}

function mapShopeeTokenPayload(data: unknown, fallbackRefreshToken?: string): ShopeeOAuthTokens {
  if (!isRecord(data)) {
    throw new Error('Shopee: geçersiz token yanıtı');
  }
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Shopee: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken?.trim() ||
    '';
  if (refreshToken.length === 0) {
    throw new Error('Shopee: refresh_token alınamadı');
  }
  const expiresIn =
    typeof data.expire_in === 'number' && Number.isFinite(data.expire_in)
      ? data.expire_in
      : typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
        ? data.expires_in
        : 14_400;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}

function assertShopeeEnvelope(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new Error('Shopee: token API yanıtı geçersiz');
  }
  const err = data.error;
  if (typeof err === 'string' && err.length > 0) {
    const msg = typeof data.message === 'string' ? data.message : err;
    throw new Error(`Shopee: ${msg}`);
  }
  return data;
}

async function shopeeAuthPost(
  path: string,
  partnerId: string,
  partnerKey: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = shopeePublicSign(partnerKey, partnerId, path, timestamp);
  const { data } = await axios.post<unknown>(
    `${SHOPEE_BASE}${path}`,
    body,
    {
      params: {
        partner_id: partnerId,
        timestamp,
        sign,
      },
      headers: { 'Content-Type': 'application/json' },
      timeout: 20_000,
    },
  );
  const envelope = assertShopeeEnvelope(data);
  return envelope;
}

export async function exchangeShopeeAuthorizationCode(
  partnerId: string,
  partnerKey: string,
  code: string,
  shopId: string,
): Promise<ShopeeOAuthTokens> {
  const envelope = await shopeeAuthPost('/api/v2/auth/token/get', partnerId, partnerKey, {
    code,
    partner_id: Number(partnerId),
    shop_id: Number(shopId),
  });
  const payload = isRecord(envelope) && isRecord(envelope.response) ? envelope.response : envelope;
  return mapShopeeTokenPayload(payload);
}

export async function refreshShopeeAccessToken(
  partnerId: string,
  partnerKey: string,
  refreshToken: string,
  shopId: string,
): Promise<ShopeeOAuthTokens> {
  const envelope = await shopeeAuthPost(
    '/api/v2/auth/access_token/get',
    partnerId,
    partnerKey,
    {
      refresh_token: refreshToken,
      partner_id: Number(partnerId),
      shop_id: Number(shopId),
    },
  );
  const payload = isRecord(envelope) && isRecord(envelope.response) ? envelope.response : envelope;
  return mapShopeeTokenPayload(payload, refreshToken);
}
