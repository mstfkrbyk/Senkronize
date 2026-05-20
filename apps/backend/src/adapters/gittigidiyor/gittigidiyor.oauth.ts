import { createHmac, randomBytes } from 'crypto';

import axios from 'axios';

import {
  GITTIGIDIYOR_DEVAPI_BASE,
  GITTIGIDIYOR_OAUTH_BASE,
} from './gittigidiyor.constants';

export interface GittigidiyorOAuthRequestToken {
  oauthToken: string;
  oauthTokenSecret: string;
  oauthCallbackConfirmed?: boolean;
}

export interface GittigidiyorOAuthAccessToken {
  oauthToken: string;
  oauthTokenSecret: string;
  tokenExpiresAt?: number;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function parseOAuthResponse(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of body.split('&')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = decodeURIComponent(pair.slice(0, eq));
    const value = decodeURIComponent(pair.slice(eq + 1));
    out[key] = value;
  }
  return out;
}

function buildOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = '',
): string {
  const normalized = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k] ?? '')}`)
    .join('&');
  const base = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(normalized),
  ].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(base, 'utf8').digest('base64');
}

function oauthParams(
  apiKey: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...extra,
  };
}

async function signedOAuthRequest(
  method: 'GET' | 'POST',
  url: string,
  apiKey: string,
  apiSecret: string,
  extraParams: Record<string, string> = {},
  tokenSecret = '',
): Promise<string> {
  const params = oauthParams(apiKey, extraParams);
  params.oauth_signature = buildOAuthSignature(
    method,
    url,
    params,
    apiSecret,
    tokenSecret,
  );
  const query = new URLSearchParams(params).toString();
  const fullUrl = method === 'GET' ? `${url}?${query}` : url;
  const { data } = await axios.request<string>({
    method,
    url: fullUrl,
    ...(method === 'POST'
      ? {
          data: query,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      : {}),
    timeout: 20_000,
    responseType: 'text',
    transformResponse: [(r: unknown) => r],
  });
  return typeof data === 'string' ? data : String(data);
}

export async function requestGittigidiyorOAuthToken(
  apiKey: string,
  apiSecret: string,
  callbackUrl: string,
): Promise<GittigidiyorOAuthRequestToken> {
  const url = `${GITTIGIDIYOR_OAUTH_BASE}/request_token`;
  const body = await signedOAuthRequest('GET', url, apiKey, apiSecret, {
    oauth_callback: callbackUrl,
  });
  const parsed = parseOAuthResponse(body);
  const oauthToken = parsed.oauth_token?.trim() ?? '';
  const oauthTokenSecret = parsed.oauth_token_secret?.trim() ?? '';
  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('GittiGidiyor: oauth request token alınamadı');
  }
  return {
    oauthToken,
    oauthTokenSecret,
    oauthCallbackConfirmed: parsed.oauth_callback_confirmed === 'true',
  };
}

export function buildGittigidiyorAuthorizeUrl(oauthToken: string): string {
  return `${GITTIGIDIYOR_OAUTH_BASE}/authorize?oauth_token=${encodeURIComponent(oauthToken)}`;
}

export async function exchangeGittigidiyorAccessToken(
  apiKey: string,
  apiSecret: string,
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string,
): Promise<GittigidiyorOAuthAccessToken> {
  const url = `${GITTIGIDIYOR_OAUTH_BASE}/access_token`;
  const body = await signedOAuthRequest(
    'POST',
    url,
    apiKey,
    apiSecret,
    { oauth_token: oauthToken, oauth_verifier: oauthVerifier },
    oauthTokenSecret,
  );
  const parsed = parseOAuthResponse(body);
  const token = parsed.oauth_token?.trim() ?? '';
  const secret = parsed.oauth_token_secret?.trim() ?? '';
  if (!token || !secret) {
    throw new Error('GittiGidiyor: oauth access token alınamadı');
  }
  return {
    oauthToken: token,
    oauthTokenSecret: secret,
    tokenExpiresAt: Date.now() + 365 * 24 * 3600 * 1000,
  };
}

export function signGittigidiyorOAuthRequest(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  apiKey: string,
  apiSecret: string,
  oauthToken: string,
  oauthTokenSecret: string,
  queryParams: Record<string, string> = {},
): { url: string; headers: Record<string, string> } {
  const basePath = path.startsWith('/') ? path : `/${path}`;
  const url = `${GITTIGIDIYOR_DEVAPI_BASE}${basePath}`;
  const params = {
    ...queryParams,
    ...oauthParams(apiKey, { oauth_token: oauthToken }),
  };
  params.oauth_signature = buildOAuthSignature(
    method,
    url,
    params,
    apiSecret,
    oauthTokenSecret,
  );
  const qs = new URLSearchParams(params).toString();
  return {
    url: `${url}?${qs}`,
    headers: { Accept: 'application/json' },
  };
}

export function buildLegacyGgSign(
  apiKey: string,
  apiSecret: string,
): { sign: string; time: string } {
  const time = String(Date.now());
  const sign = createHmac('sha1', apiSecret)
    .update(apiKey + time, 'utf8')
    .digest('base64');
  return { sign, time };
}
