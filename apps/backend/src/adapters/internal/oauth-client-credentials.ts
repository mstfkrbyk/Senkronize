import { axiosWithRetry } from '../../common/utils/http-retry';
import type { OAuthTokenResponse } from './rest-stub-marketplace.types';

export async function fetchClientCredentialsToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const data = await axiosWithRetry<OAuthTokenResponse>(
    {
      method: 'POST',
      url: tokenUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      timeout: 15_000,
    },
    {},
  );
  const token = typeof data.access_token === 'string' ? data.access_token : '';
  if (!token) {
    throw new Error('OAuth2: access_token alınamadı');
  }
  return token;
}
