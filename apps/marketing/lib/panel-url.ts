/**
 * Panel (uygulama) kök URL — giriş ve kayıt linkleri için.
 * `NEXT_PUBLIC_PANEL_URL` ile override edilebilir.
 */
export function getPanelUrl(): string {
  const url = process.env.NEXT_PUBLIC_PANEL_URL;
  if (url && url.length > 0) {
    return url.replace(/\/$/, '');
  }
  return 'https://app.senkronize.com';
}
