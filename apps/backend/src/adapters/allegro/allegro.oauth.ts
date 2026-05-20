import axios from 'axios';

import { ALLEGRO_TOKEN_URL } from './allegro.constants';
import type { AllegroTokenResponse } from './allegro.types';

export interface AllegroOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export async function refreshAllegroAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<AllegroOAuthTokens> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const { data } = await axios.post<AllegroTokenResponse>(ALLEGRO_TOKEN_URL, body, {
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 20_000,
  });
  return mapAllegroTokenResponse(data, refreshToken);
}

function mapAllegroTokenResponse(
  data: AllegroTokenResponse,
  fallbackRefreshToken: string,
): AllegroOAuthTokens {
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Allegro: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken.trim();
  if (refreshToken.length === 0) {
    throw new Error('Allegro: refresh_token zorunludur');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 43200;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}
