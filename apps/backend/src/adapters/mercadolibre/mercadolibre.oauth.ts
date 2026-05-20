import axios from 'axios';

import { MERCADOLIBRE_TOKEN_URL } from './mercadolibre.constants';
import type { MercadolibreTokenResponse } from './mercadolibre.types';

export interface MercadolibreOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export async function refreshMercadolibreAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<MercadolibreOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const { data } = await axios.post<MercadolibreTokenResponse>(MERCADOLIBRE_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20_000,
  });
  return mapMercadolibreTokenResponse(data, refreshToken);
}

function mapMercadolibreTokenResponse(
  data: MercadolibreTokenResponse,
  fallbackRefreshToken: string,
): MercadolibreOAuthTokens {
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('MercadoLibre: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken.trim();
  if (refreshToken.length === 0) {
    throw new Error('MercadoLibre: refresh_token zorunludur');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 21_600;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}
