/**
 * Pazarlama sitesi kök URL — paylaşım linkleri ve metadata için.
 */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url && url.length > 0) {
    return url.replace(/\/$/, '');
  }
  return 'https://senkronize.com';
}
