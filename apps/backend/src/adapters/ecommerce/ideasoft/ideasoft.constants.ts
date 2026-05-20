export const IDEASOFT_API_VERSION = 'v1';

export function resolveIdeasoftDomain(credentials: Record<string, string>): string {
  const raw =
    credentials.domain?.trim() ??
    credentials.storeUrl?.trim() ??
    credentials.baseUrl?.trim() ??
    '';
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export function ideasoftApiBase(credentials: Record<string, string>): string {
  const domain = resolveIdeasoftDomain(credentials);
  if (!domain) {
    return '';
  }
  return `https://${domain}/api/${IDEASOFT_API_VERSION}`;
}

export function ideasoftTokenUrl(credentials: Record<string, string>): string {
  const domain = resolveIdeasoftDomain(credentials);
  if (!domain) {
    return '';
  }
  return `https://${domain}/oauth/v2/token`;
}
