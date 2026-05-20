export const TICIMAX_API_VERSION = 'v1';

export function resolveTicimaxDomain(credentials: Record<string, string>): string {
  const raw =
    credentials.domain?.trim() ??
    credentials.storeUrl?.trim() ??
    credentials.apiUrl?.trim() ??
    credentials.siteUrl?.trim() ??
    '';
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export function ticimaxApiBase(credentials: Record<string, string>): string {
  const domain = resolveTicimaxDomain(credentials);
  if (!domain) {
    return '';
  }
  return `https://${domain}/api/${TICIMAX_API_VERSION}`;
}
