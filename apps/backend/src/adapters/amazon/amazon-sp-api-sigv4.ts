import { createHash, createHmac } from 'crypto';
import type { AxiosRequestHeaders, InternalAxiosRequestConfig } from 'axios';

const SP_API_REGION = 'eu-west-1';
const SP_API_SERVICE = 'execute-api';

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function resolveHost(baseUrl: string): string {
  return new URL(baseUrl).host;
}

function canonicalQueryString(url: URL): string {
  if (!url.search || url.search.length <= 1) {
    return '';
  }
  const params = [...url.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return params.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Amazon SP-API istekleri için AWS Signature Version 4 (execute-api / eu-west-1).
 */
export function signAmazonSpApiRequest(
  config: InternalAxiosRequestConfig,
  accessKeyId: string,
  secretAccessKey: string,
  baseUrl: string,
): InternalAxiosRequestConfig {
  const method = (config.method ?? 'GET').toUpperCase();
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = config.url?.startsWith('http')
    ? config.url
    : `${base}${config.url?.startsWith('/') ? config.url : `/${config.url ?? ''}`}`;
  const url = new URL(path);
  const host = resolveHost(base);
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);

  const body =
    config.data === undefined || config.data === null
      ? ''
      : typeof config.data === 'string'
        ? config.data
        : JSON.stringify(config.data);

  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  const existing = config.headers ?? {};
  for (const [key, value] of Object.entries(existing)) {
    if (value === undefined || value === null) {
      continue;
    }
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'authorization') {
      continue;
    }
    headers[lower] = Array.isArray(value) ? value.join(',') : String(value);
  }

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${headers[k]?.trim()}\n`)
    .join('');
  const signedHeaders = signedHeaderKeys.join(';');

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQueryString(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${SP_API_REGION}/${SP_API_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = hmacSha256(
    signingKey(secretAccessKey, dateStamp, SP_API_REGION, SP_API_SERVICE),
    stringToSign,
  ).toString('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  config.headers = {
    ...existing,
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  } as unknown as AxiosRequestHeaders;
  return config;
}
