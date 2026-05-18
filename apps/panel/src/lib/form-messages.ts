/** Ortak panel form doğrulama metinleri (Türkçe) */
export const FORM_MESSAGES = {
  required: 'Bu alan zorunludur',
  email: 'Geçerli bir e-posta adresi girin',
  urlHttps: 'Geçerli bir URL girin (https:// ile başlamalı)',
  pricePositive: "Fiyat 0'dan büyük olmalıdır",
} as const;

/** Pazaryeri / ERP kimlik bilgisi alanlarında tam HTTPS URL beklenen anahtarlar */
export const HTTPS_URL_CREDENTIAL_KEYS = new Set(['storeUrl', 'siteUrl']);

/** `url` tipi alanlar — http veya https kabul edilir */
export const HTTP_OR_HTTPS_URL_FIELD_TYPES = new Set(['url']);

export function isValidHttpsUrl(value: string): boolean {
  const t = value.trim();
  if (t.length === 0) {
    return false;
  }
  try {
    const u = new URL(t);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidHttpOrHttpsUrl(value: string): boolean {
  const t = value.trim();
  if (t.length === 0) {
    return false;
  }
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
