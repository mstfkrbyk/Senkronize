import axios from 'axios';

import { isRecord } from '../stub-helpers';
import { lazadaSign } from '../lazada/lazada.oauth';
import {
  DARAZ_ACCESS_TOKEN_TTL_SEC,
  DARAZ_AUTH_REST,
  DARAZ_AUTHORIZE_URL,
  DARAZ_COUNTRY_API_BASE,
  DARAZ_API_BASE,
  type DarazCountryCode,
} from './daraz.constants';

export interface DarazOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export type DarazTokenResult = DarazOAuthTokens;

export { lazadaSign as darazSign };

export function buildDarazAuthorizeUrl(
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
  return `${DARAZ_AUTHORIZE_URL}?${params.toString()}`;
}

function mapDarazTokenPayload(data: unknown, fallbackRefreshToken?: string): DarazOAuthTokens {
  if (!isRecord(data)) {
    throw new Error('Daraz: geçersiz token yanıtı');
  }
  const accessToken =
    typeof data.access_token === 'string' ? data.access_token.trim() : '';
  if (accessToken.length === 0) {
    throw new Error('Daraz: access_token alınamadı');
  }
  const refreshToken =
    (typeof data.refresh_token === 'string' && data.refresh_token.trim()) ||
    fallbackRefreshToken?.trim() ||
    '';
  if (refreshToken.length === 0) {
    throw new Error('Daraz: refresh_token alınamadı');
  }
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : DARAZ_ACCESS_TOKEN_TTL_SEC;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  };
}

async function darazTokenRequest(
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
  const url = `${DARAZ_AUTH_REST}${apiName}`;
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
    throw new Error('Daraz: token API yanıtı geçersiz');
  }
  const code = data.code;
  if (code !== undefined && code !== '0' && code !== 0) {
    const msg =
      typeof data.message === 'string' ? data.message : 'Token isteği başarısız';
    throw new Error(`Daraz: ${msg}`);
  }
  return data.data ?? data;
}

export async function refreshDarazAccessToken(
  appKey: string,
  appSecret: string,
  refreshToken: string,
): Promise<DarazTokenResult> {
  const payload = await darazTokenRequest(
    '/auth/token/refresh',
    appKey,
    appSecret,
    { refresh_token: refreshToken },
    'POST',
  );
  return mapDarazTokenPayload(payload, refreshToken);
}

export async function exchangeDarazAuthorizationCode(
  appKey: string,
  appSecret: string,
  code: string,
): Promise<DarazTokenResult> {
  const payload = await darazTokenRequest(
    '/auth/token/create',
    appKey,
    appSecret,
    { code },
    'POST',
  );
  return mapDarazTokenPayload(payload);
}

function normalizeDarazCountry(raw: string): DarazCountryCode | null {
  const c = raw.trim().toLowerCase();
  if (c === 'pk' || c === 'bd' || c === 'lk' || c === 'np') {
    return c;
  }
  return null;
}

/** İş API çağrıları için bölgesel uç (LK varsayılan). */
export function darazBusinessApiBase(credentials: Record<string, string>): string {
  const custom = credentials.apiBaseUrl?.trim() ?? credentials.baseUrl?.trim();
  if (custom && custom.length > 0) {
    return custom.replace(/\/+$/, '');
  }
  const countryRaw =
    credentials.country?.trim() ??
    credentials.region?.trim() ??
    credentials.marketplace?.trim() ??
    '';
  const country = normalizeDarazCountry(countryRaw);
  if (country) {
    return DARAZ_COUNTRY_API_BASE[country];
  }
  return DARAZ_API_BASE;
}
