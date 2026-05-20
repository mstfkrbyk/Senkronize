import { createHmac } from 'node:crypto';

/** Coupang Open API CEA imza tarihi (UTC, `YYYYMMDDTHHMMSSZ`). */
export function coupangSignedDate(now = new Date()): string {
  return now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
}

/**
 * Coupang Gateway HMAC-SHA256 Authorization başlığı.
 * @see https://developers.coupang.com/hc/en-us/articles/360033917054
 */
export function coupangHmac(
  method: string,
  path: string,
  accessKey: string,
  secretKey: string,
  now = new Date(),
): string {
  const datetime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const message = `${datetime}${method.toUpperCase()}${path}`;
  const signature = createHmac('sha256', secretKey)
    .update(message, 'utf8')
    .digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * Coupang CEA HMAC-SHA256 imzası (legacy api.coupang.com).
 * @deprecated Yeni entegrasyonlarda {@link coupangHmac} kullanın.
 */
export function coupangAuthorizationHeader(
  accessKey: string,
  secretKey: string,
  method: string,
  path: string,
  queryString = '',
  now = new Date(),
): string {
  const signedDate = coupangSignedDate(now);
  const verb = method.toUpperCase();
  const message = `${signedDate}\n${verb}\n${queryString}\n${path}\n`;
  const signature = createHmac('sha256', secretKey)
    .update(message, 'utf8')
    .digest('hex')
    .toLowerCase();
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}
