/**
 * Genel API kök adresi. Yerelde `http://localhost:3001` kullanın.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url && url.length > 0) {
    return url.replace(/\/$/, '');
  }
  return 'https://api.senkronize.com';
}
