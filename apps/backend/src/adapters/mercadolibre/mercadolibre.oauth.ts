import axios from 'axios';

import {
  MERCADOLIBRE_ACCESS_TOKEN_TTL_SEC,
  MERCADOLIBRE_AUTHORIZE_URL,
  MERCADOLIBRE_TOKEN_URL,
} from './mercadolibre.constants';
import type { MercadolibreTokenResponse } from './mercadolibre.types';

export interface MercadolibreOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  userId?: string;
}

export function buildMercadolibreAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${MERCADOLIBRE_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeMercadolibreAuthorizationCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<MercadolibreOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const { data } = await axios.post<MercadolibreTokenResponse>(MERCADOLIBRE_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20_000,
  });
  return mapMercadolibreTokenResponse(data);
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
  fallbackRefreshToken?: string,
): MercadolibreOAuthTokens {
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('MercadoLibre: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken?.trim() ||
    '';
  if (refreshToken.length === 0) {
    throw new Error('MercadoLibre: refresh_token zorunludur');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : MERCADOLIBRE_ACCESS_TOKEN_TTL_SEC;
  const userId =
    typeof data.user_id === 'number'
      ? String(data.user_id)
      : typeof data.user_id === 'string'
        ? data.user_id
        : undefined;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
    userId,
  };
}
