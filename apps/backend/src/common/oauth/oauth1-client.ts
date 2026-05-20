import { createHmac, randomBytes } from 'crypto';

export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'HMAC-SHA256';

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  realm?: string;
  signatureMethod?: OAuth1SignatureMethod;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
  signatureMethod: OAuth1SignatureMethod,
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
  const algo = signatureMethod === 'HMAC-SHA256' ? 'sha256' : 'sha1';
  return createHmac(algo, signingKey).update(base, 'utf8').digest('base64');
}

export function buildOAuth1AuthorizationHeader(
  method: string,
  url: string,
  creds: OAuth1Credentials,
): string {
  const signatureMethod = creds.signatureMethod ?? 'HMAC-SHA256';
  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_token: creds.tokenId,
    oauth_signature_method: signatureMethod,
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_version: '1.0',
  };
  params.oauth_signature = buildOAuthSignature(
    method,
    url,
    params,
    creds.consumerSecret,
    creds.tokenSecret,
    signatureMethod,
  );

  const parts = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k] ?? '')}"`);

  if (creds.realm) {
    return `OAuth realm="${percentEncode(creds.realm)}", ${parts.join(', ')}`;
  }
  return `OAuth ${parts.join(', ')}`;
}
