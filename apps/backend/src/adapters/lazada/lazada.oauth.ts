import { createHmac } from 'node:crypto';

import axios from 'axios';

import { isRecord } from '../stub-helpers';
import {
  LAZADA_ACCESS_TOKEN_TTL_SEC,
  LAZADA_API_BASE,
  LAZADA_AUTH_REST,
  LAZADA_AUTHORIZE_URL,
} from './lazada.constants';

export interface LazadaOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export type LazadaTokenResult = LazadaOAuthTokens;

export function lazadaSign(
  apiName: string,
  params: Record<string, string>,
  appSecret: string,
): string {
  const keys = Object.keys(params).sort();
  const concatenated = keys.map((k) => `${k}${params[k]}`).join('');
  return createHmac('sha256', appSecret)
    .update(`${apiName}${concatenated}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

export function buildLazadaAuthorizeUrl(
  appKey: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    force_auth: 'true',
    redirect_uri: redirectUri,
    client_id: appKey,
    state,
  });
  return `${LAZADA_AUTHORIZE_URL}?${params.toString()}`;
}

function mapLazadaTokenPayload(data: unknown, fallbackRefreshToken?: string): LazadaOAuthTokens {
  if (!isRecord(data)) {
    throw new Error('Lazada: geçersiz token yanıtı');
  }
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Lazada: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken?.trim() ||
    '';
  if (refreshToken.length === 0) {
    throw new Error('Lazada: refresh_token alınamadı');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : LAZADA_ACCESS_TOKEN_TTL_SEC;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}

async function lazadaTokenRequest(
  baseUrl: string,
  apiName: string,
  appKey: string,
  appSecret: string,
  params: Record<string, string>,
  method: 'GET' | 'POST' = 'GET',
): Promise<unknown> {
  const timestamp = String(Date.now());
  const signParams: Record<string, string> = {
    app_key: appKey,
    sign_method: 'sha256',
    timestamp,
    ...params,
  };
  const sign = lazadaSign(apiName, signParams, appSecret);
  const url = `${baseUrl}${apiName}`;
  const { data } =
    method === 'POST'
      ? await axios.post<unknown>(url, null, {
          params: { ...signParams, sign },
          timeout: 20_000,
        })
      : await axios.get<unknown>(url, {
          params: { ...signParams, sign },
          timeout: 20_000,
        });
  if (!isRecord(data)) {
    throw new Error('Lazada: token API yanıtı geçersiz');
  }
  const code = data.code;
  if (code !== undefined && code !== '0' && code !== 0) {
    const msg =
      typeof data.message === 'string' ? data.message : 'Token isteği başarısız';
    throw new Error(`Lazada: ${msg}`);
  }
  return data.data ?? data;
}

export async function refreshLazadaAccessToken(
  appKey: string,
  appSecret: string,
  refreshToken: string,
): Promise<LazadaTokenResult> {
  const payload = await lazadaTokenRequest(
    LAZADA_AUTH_REST,
    '/auth/token/refresh',
    appKey,
    appSecret,
    { refresh_token: refreshToken },
    'POST',
  );
  return mapLazadaTokenPayload(payload, refreshToken);
}

export async function exchangeLazadaAuthorizationCode(
  appKey: string,
  appSecret: string,
  code: string,
): Promise<LazadaTokenResult> {
  const payload = await lazadaTokenRequest(
    LAZADA_AUTH_REST,
    '/auth/token/create',
    appKey,
    appSecret,
    { code },
    'POST',
  );
  return mapLazadaTokenPayload(payload);
}

/** İş API çağrıları için mevcut bölgesel uç (MY varsayılan). */
export function lazadaBusinessApiBase(credentials: Record<string, string>): string {
  const custom = credentials.apiBaseUrl?.trim() ?? credentials.baseUrl?.trim();
  if (custom && custom.length > 0) {
    return custom.replace(/\/+$/, '');
  }
  return LAZADA_API_BASE;
}
