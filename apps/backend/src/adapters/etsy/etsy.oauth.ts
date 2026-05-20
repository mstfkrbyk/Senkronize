import axios from 'axios';

import {
  ETSY_OAUTH_AUTHORIZE_URL,
  ETSY_OAUTH_SCOPES,
  ETSY_OAUTH_TOKEN_URL,
} from './etsy.constants';

export interface EtsyOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface EtsyOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export function buildEtsyAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge?: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: ETSY_OAUTH_SCOPES,
    client_id: clientId,
    state,
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${ETSY_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeEtsyAuthorizationCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<EtsyOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }
  const { data } = await axios.post<EtsyOAuthTokenResponse>(
    ETSY_OAUTH_TOKEN_URL,
    body,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': clientId,
      },
      auth: { username: clientId, password: clientSecret },
      timeout: 20_000,
    },
  );
  return mapEtsyTokenResponse(data);
}

export async function refreshEtsyAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<EtsyOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });
  const { data } = await axios.post<EtsyOAuthTokenResponse>(
    ETSY_OAUTH_TOKEN_URL,
    body,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': clientId,
      },
      auth: { username: clientId, password: clientSecret },
      timeout: 20_000,
    },
  );
  return mapEtsyTokenResponse(data, refreshToken);
}

function mapEtsyTokenResponse(
  data: EtsyOAuthTokenResponse,
  fallbackRefreshToken?: string,
): EtsyOAuthTokens {
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Etsy: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken?.trim() ||
    '';
  if (refreshToken.length === 0) {
    throw new Error('Etsy: refresh_token alınamadı');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}
