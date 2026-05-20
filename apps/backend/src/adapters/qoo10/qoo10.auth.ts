import { createHmac } from 'node:crypto';

import axios from 'axios';

import { isRecord } from '../stub-helpers';
import type { Qoo10ApiEnvelope } from './qoo10.types';

export const QOO10_SELLER_BASE =
  'https://api.qoo10.com/GMKT.INC.Front.OpenAPI/Seller';
export const QOO10_GOODS_BASE =
  'https://api.qoo10.com/GMKT.INC.Front.OpenAPI/Goods';

export interface Qoo10ResolvedCredentials {
  applicationKey: string;
  userKey: string;
  secretKey: string;
  password?: string;
}

export function resolveQoo10Credentials(
  credentials: Record<string, string>,
): Qoo10ResolvedCredentials {
  const applicationKey =
    credentials.applicationKey?.trim() ??
    credentials.apiKey?.trim() ??
    credentials.qKey?.trim() ??
    '';
  const userKey =
    credentials.userKey?.trim() ??
    credentials.userId?.trim() ??
    credentials.sellerId?.trim() ??
    '';
  const secretKey =
    credentials.secretKey?.trim() ??
    credentials.apiSecret?.trim() ??
    applicationKey;
  const password = credentials.password?.trim();
  if (!applicationKey || !userKey) {
    throw new Error(
      'Qoo10: applicationKey (apiKey) ve userKey (userId/sellerId) zorunludur',
    );
  }
  return { applicationKey, userKey, secretKey, password };
}

/** QAuthKey: applicationKey + userKey + timestamp HMAC. */
export function buildQAuthKey(
  applicationKey: string,
  userKey: string,
  secretKey: string,
  timestamp = Math.floor(Date.now() / 1000).toString(),
): string {
  const signature = createHmac('sha256', secretKey)
    .update(`${applicationKey}${userKey}${timestamp}`, 'utf8')
    .digest('hex');
  return `${applicationKey};${userKey};${timestamp};${signature}`;
}

function unwrapCertificationKey(data: unknown): string {
  if (!isRecord(data)) {
    throw new Error('Qoo10 sertifika yanıtı geçersiz');
  }
  const env = data as Qoo10ApiEnvelope;
  const code = env.ResultCode;
  if (code !== undefined && code !== 0 && code !== '0' && code !== '00') {
    const msg =
      typeof env.ResultMsg === 'string'
        ? env.ResultMsg
        : 'Qoo10 sertifika anahtarı alınamadı';
    throw new Error(msg);
  }
  const raw = env.ResultObject ?? data;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  if (isRecord(raw)) {
    const key =
      (typeof raw.CertificationKey === 'string' && raw.CertificationKey) ||
      (typeof raw.Key === 'string' && raw.Key) ||
      '';
    if (key.length > 0) {
      return key.trim();
    }
  }
  throw new Error('Qoo10 sertifika yanıtında anahtar yok');
}

/** Şifre varsa CreateCertificationKey; yoksa QAuthKey HMAC üretir. */
export async function fetchQoo10AccessToken(
  creds: Qoo10ResolvedCredentials,
): Promise<string> {
  if (creds.password) {
    const { data } = await axios.post<unknown>(
      `${QOO10_SELLER_BASE}/seller/CreateCertificationKey`,
      {
        user_id: creds.userKey,
        pwd: creds.password,
        key: creds.applicationKey,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20_000,
      },
    );
    return unwrapCertificationKey(data);
  }
  return buildQAuthKey(creds.applicationKey, creds.userKey, creds.secretKey);
}
