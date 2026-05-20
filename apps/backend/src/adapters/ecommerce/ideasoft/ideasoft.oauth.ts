import axios from 'axios';

import { ideasoftTokenUrl } from './ideasoft.constants';
import type { IdeasoftTokenResponse } from './ideasoft.types';

export interface IdeasoftAccessTokenResult {
  accessToken: string;
  tokenExpiresAt: number;
}

export async function fetchIdeasoftAccessToken(
  credentials: Record<string, string>,
): Promise<IdeasoftAccessTokenResult> {
  const clientId =
    credentials.clientId?.trim() ??
    credentials.apiKey?.trim() ??
    '';
  const clientSecret =
    credentials.clientSecret?.trim() ??
    credentials.apiSecret?.trim() ??
    '';
  const tokenUrl = ideasoftTokenUrl(credentials);
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('IdeaSoft: domain, clientId ve clientSecret zorunludur');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const { data } = await axios.post<IdeasoftTokenResponse>(tokenUrl, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20_000,
  });
  const accessToken = data.access_token?.trim();
  if (!accessToken) {
    throw new Error('IdeaSoft: access_token alınamadı');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;
  return {
    accessToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}

export async function refreshIdeasoftAccessToken(
  credentials: Record<string, string>,
): Promise<Record<string, string>> {
  const tokens = await fetchIdeasoftAccessToken(credentials);
  return {
    ...credentials,
    accessToken: tokens.accessToken,
    tokenExpiresAt: String(tokens.tokenExpiresAt),
  };
}
