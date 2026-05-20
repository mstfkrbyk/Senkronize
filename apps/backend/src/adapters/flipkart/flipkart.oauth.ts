import { Buffer } from 'node:buffer';

import axios from 'axios';

import {
  FLIPKART_ACCESS_TOKEN_TTL_SEC,
  FLIPKART_OAUTH_SCOPE,
  FLIPKART_TOKEN_URL,
} from './flipkart.constants';
import type { FlipkartTokenResponse } from './flipkart.types';

export interface FlipkartOAuthTokens {
  accessToken: string;
  tokenExpiresAt: number;
}

export async function fetchFlipkartClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<FlipkartOAuthTokens> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: FLIPKART_OAUTH_SCOPE,
  });
  const { data } = await axios.post<FlipkartTokenResponse>(FLIPKART_TOKEN_URL, body, {
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 20_000,
  });
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Flipkart: access_token alınamadı');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : FLIPKART_ACCESS_TOKEN_TTL_SEC;
  return {
    accessToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}
