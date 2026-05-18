export const SHOPIFY_API_VERSION = '2024-04';

export function shopifyBaseUrl(shop: string): string {
  const host = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return `https://${host}/admin/api/${SHOPIFY_API_VERSION}`;
}
