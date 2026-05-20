import axios from 'axios';

import { EBAY_IDENTITY_URL } from './ebay.constants';
import type { EbayOAuthTokenResponse } from './ebay.types';

export interface EbayOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export async function refreshEbayAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<EbayOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const { data } = await axios.post<EbayOAuthTokenResponse>(EBAY_IDENTITY_URL, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    timeout: 20_000,
  });
  return mapEbayTokenResponse(data, refreshToken);
}

function mapEbayTokenResponse(
  data: EbayOAuthTokenResponse,
  fallbackRefreshToken: string,
): EbayOAuthTokens {
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('eBay: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken.trim();
  if (refreshToken.length === 0) {
    throw new Error('eBay: refresh_token zorunludur');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 7200;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}
