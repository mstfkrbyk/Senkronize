/** Bilinen firmalar için takip URL'i; aksi halde genel arama. */
export function buildCargoTrackingUrl(
  tracking: string,
  provider?: string | null,
): string {
  const trimmed = tracking.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const p = (provider ?? '').toLowerCase();
  if (p.includes('yurtiçi') || p.includes('yurtici')) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?k=${encodeURIComponent(trimmed)}`;
  }
  if (p.includes('aras')) {
    return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(trimmed)}`;
  }
  if (p.includes('mng')) {
    return `https://www.mngkargo.com.tr/gonderi-takip?gonderino=${encodeURIComponent(trimmed)}`;
  }
  if (p.includes('ptt')) {
    return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${encodeURIComponent(trimmed)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${provider ?? ''} ${trimmed} kargo takip`.trim())}`;
}
