import { Buffer } from 'node:buffer';

import axios from 'axios';

import { isRecord } from '../stub-helpers';
import { NOON_ACCESS_TOKEN_TTL_SEC, NOON_OAUTH_TOKEN_URL } from './noon.constants';

export interface NoonOAuthTokens {
  accessToken: string;
  tokenExpiresAt: number;
}

export async function fetchNoonClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<NoonOAuthTokens> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const { data } = await axios.post<unknown>(NOON_OAUTH_TOKEN_URL, body, {
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    timeout: 20_000,
  });
  if (!isRecord(data)) {
    throw new Error('Noon: geçersiz token yanıtı');
  }
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Noon: access_token alınamadı');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : NOON_ACCESS_TOKEN_TTL_SEC;
  return {
    accessToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}
