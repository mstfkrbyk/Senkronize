/** Prisma `CargoProvider` enum değerleri ile uyumlu şablonlar ({trackingCode} yer tutucu) */
export const CARGO_TRACKING_URLS: Record<string, string> = {
  YURTICI:
    'https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code={trackingCode}',
  ARAS: 'https://kargotakip.araskargo.com.tr/?code={trackingCode}',
  SURAT: 'https://www.suratcargo.com/kargosorgu?barcode={trackingCode}',
  MNG: 'https://www.mngkargo.com.tr/mngkargo/kargo-takip?barcode={trackingCode}',
  UPS: 'https://www.ups.com/track?tracknum={trackingCode}',
  DHL: 'https://www.dhl.com/tr-tr/home/tracking.html?tracking-id={trackingCode}',
  SENDEO: 'https://www.sendeo.com.tr/tr/kargo-takip?barcode={trackingCode}',
  PTT_KARGO: 'https://www.ptt.gov.tr/KargoTakip?barcode={trackingCode}',
  PTT: 'https://gonderitakip.ptt.gov.tr/Track/Verify?q={trackingCode}',
  HEPSIJET: 'https://www.google.com/search?q={trackingCode}+hepsijet+kargo+takip',
  TRENDYOL_EXPRESS:
    'https://www.google.com/search?q={trackingCode}+trendyol+express+kargo+takip',
};

function applyTemplate(template: string, trackingCode: string): string {
  return template.replaceAll('{trackingCode}', encodeURIComponent(trackingCode));
}

function normalizeProviderKey(provider?: string | null): string | null {
  if (!provider || provider.trim().length === 0) {
    return null;
  }
  const u = provider.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (u in CARGO_TRACKING_URLS) {
    return u;
  }
  const compact = provider.trim().toUpperCase().replace(/\s+/g, '');
  const match = Object.keys(CARGO_TRACKING_URLS).find((k) => k === compact);
  return match ?? null;
}

/** Bilinen firmalar için takip URL'i; aksi halde genel arama. */
export function buildCargoTrackingUrl(
  tracking: string,
  provider?: string | null,
): string {
  const trimmed = tracking.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const key = normalizeProviderKey(provider);
  if (key && CARGO_TRACKING_URLS[key]) {
    return applyTemplate(CARGO_TRACKING_URLS[key], trimmed);
  }
  const p = (provider ?? '').toLowerCase();
  if (p.includes('yurtiçi') || p.includes('yurtici')) {
    return applyTemplate(CARGO_TRACKING_URLS.YURTICI, trimmed);
  }
  if (p.includes('aras')) {
    return applyTemplate(CARGO_TRACKING_URLS.ARAS, trimmed);
  }
  if (p.includes('mng')) {
    return applyTemplate(CARGO_TRACKING_URLS.MNG, trimmed);
  }
  if (p.includes('sürat') || p.includes('surat')) {
    return applyTemplate(CARGO_TRACKING_URLS.SURAT, trimmed);
  }
  if (p.includes('ups')) {
    return applyTemplate(CARGO_TRACKING_URLS.UPS, trimmed);
  }
  if (p.includes('dhl')) {
    return applyTemplate(CARGO_TRACKING_URLS.DHL, trimmed);
  }
  if (p.includes('sendeo')) {
    return applyTemplate(CARGO_TRACKING_URLS.SENDEO, trimmed);
  }
  if (p.includes('ptt')) {
    return applyTemplate(CARGO_TRACKING_URLS.PTT, trimmed);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${provider ?? ''} ${trimmed} kargo takip`.trim())}`;
}
