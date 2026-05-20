import { createHmac } from 'node:crypto';

import axios from 'axios';

import { isRecord } from '../stub-helpers';

const LAZADA_API_BASE = 'https://api.lazada.com.my/rest';

export interface LazadaOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

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
      : 86_400;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}

async function lazadaTokenRequest(
  apiName: string,
  appKey: string,
  appSecret: string,
  params: Record<string, string>,
): Promise<unknown> {
  const timestamp = String(Date.now());
  const signParams: Record<string, string> = {
    app_key: appKey,
    sign_method: 'sha256',
    timestamp,
    ...params,
  };
  const sign = lazadaSign(apiName, signParams, appSecret);
  const { data } = await axios.get<unknown>(`${LAZADA_API_BASE}${apiName}`, {
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
): Promise<LazadaOAuthTokens> {
  const payload = await lazadaTokenRequest(
    '/auth/token/refresh',
    appKey,
    appSecret,
    { refresh_token: refreshToken },
  );
  return mapLazadaTokenPayload(payload, refreshToken);
}

export async function exchangeLazadaAuthorizationCode(
  appKey: string,
  appSecret: string,
  code: string,
): Promise<LazadaOAuthTokens> {
  const payload = await lazadaTokenRequest('/auth/token/create', appKey, appSecret, {
    code,
  });
  return mapLazadaTokenPayload(payload);
}
