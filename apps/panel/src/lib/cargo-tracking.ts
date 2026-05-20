import type { CargoProvider } from '@senkronize/shared';

const CORE_TRACKING_URLS: Record<string, (trackingNo: string) => string> = {
  YURTICI: (trackingNo) =>
    `https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code=${encodeURIComponent(trackingNo)}`,
  MNG: (trackingNo) =>
    `https://www.mngkargo.com.tr/?barcode=${encodeURIComponent(trackingNo)}`,
  ARAS: (trackingNo) =>
    `https://kargotakip.araskargo.com.tr/?trackingno=${encodeURIComponent(trackingNo)}`,
  PTT: (trackingNo) =>
    `https://www.ptt.gov.tr/tr/anasayfa/takip?trackNo=${encodeURIComponent(trackingNo)}`,
  PTT_KARGO: (trackingNo) =>
    `https://www.ptt.gov.tr/tr/anasayfa/takip?trackNo=${encodeURIComponent(trackingNo)}`,
  SURAT: (trackingNo) =>
    `https://www.suratkargo.com.tr/kargo-takip?barcode=${encodeURIComponent(trackingNo)}`,
  UPS: (trackingNo) =>
    `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNo)}`,
  DHL: (trackingNo) =>
    `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${encodeURIComponent(trackingNo)}`,
  DHL_PARCEL: (trackingNo) =>
    `https://www.dhl.com/tr-tr/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encodeURIComponent(trackingNo)}`,
  FEDEX: (trackingNo) =>
    `https://www.fedex.com/apps/fedextrack/?tracknumbers=${encodeURIComponent(trackingNo)}`,
};

/** Prisma `CargoProvider` enum değerleri ile uyumlu şablonlar ({trackingCode} yer tutucu) */
export const CARGO_TRACKING_URLS: Record<string, string> = {
  YURTICI:
    'https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code={trackingCode}',
  ARAS: 'https://kargotakip.araskargo.com.tr/?trackingno={trackingCode}',
  SURAT: 'https://www.suratkargo.com.tr/kargo-takip?barcode={trackingCode}',
  MNG: 'https://www.mngkargo.com.tr/wps/portal/mng/kargo-takip?barcode={trackingCode}',
  UPS: 'https://www.ups.com/track?tracknum={trackingCode}',
  DHL: 'https://www.dhl.com/tr-tr/home/tracking.html?tracking-id={trackingCode}',
  FEDEX: 'https://www.fedex.com/apps/fedextrack/?tracknumbers={trackingCode}',
  SENDEO: 'https://www.sendeo.com.tr/tr/kargo-takip?barcode={trackingCode}',
  PTT_KARGO: 'https://www.ptt.gov.tr/tr/anasayfa/takip?trackNo={trackingCode}',
  PTT: 'https://www.ptt.gov.tr/tr/anasayfa/takip?trackNo={trackingCode}',
  HEPSIJET: 'https://www.google.com/search?q={trackingCode}+hepsijet+kargo+takip',
  TRENDYOL_EXPRESS:
    'https://www.google.com/search?q={trackingCode}+trendyol+express+kargo+takip',
  NETLOG: 'https://www.netlog.com.tr/kargo-takip?code={trackingCode}',
  HOROZ: 'https://www.horoz.com.tr/kargo-takip?code={trackingCode}',
  TNT: 'https://www.tnt.com/express/tr_tr/site/shipping-tools/tracking.html?searchType=con&cons={trackingCode}',
  GLS: 'https://gls-group.eu/TR/tr/takip-ve-bul?match={trackingCode}',
  DPD: 'https://tracking.dpd.de/status/en_US/parcel/{trackingCode}',
  HERMES: 'https://www.myhermes.co.uk/track.html?parcelNumber={trackingCode}',
  POSTNL: 'https://jouw.postnl.nl/track-and-trace/{trackingCode}',
  DHL_PARCEL:
    'https://www.dhl.com/tr-tr/home/tracking/tracking-parcel.html?submit=1&tracking-id={trackingCode}',
  BRINGO: 'https://www.bringo.com.tr/kargo-takip?code={trackingCode}',
  CEVA: 'https://www.cevalogistics.com/track/{trackingCode}',
  NART_KARGO: 'https://www.nartkargo.com/takip?kod={trackingCode}',
  KOLAY_GELSIN: 'https://www.kolaygelsin.com/takip?code={trackingCode}',
  PACKUPP: 'https://www.packupp.com/takip?code={trackingCode}',
  GELAL: 'https://www.gelal.com/takip?code={trackingCode}',
  EKOL: 'https://www.ekol.com/tr/kargo-takip?code={trackingCode}',
  KOLLAY: 'https://www.kollay.com/takip?code={trackingCode}',
  HERMES_DE: 'https://www.myhermes.de/empfangen/sendungsverfolgung/?tracking={trackingCode}',
  DPD_DE: 'https://tracking.dpd.de/status/de_DE/parcel/{trackingCode}',
  CHRONOPOST: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={trackingCode}',
  CORREOS_EXPRESS: 'https://www.correosexpress.com/web/correosexpress/envios/detalle?tracking={trackingCode}',
  BRT: 'https://www.brt.it/it/servizio-clienti/ricerca-spedizioni?numero={trackingCode}',
  JT_EXPRESS: 'https://www.jtexpress.com/track?billcode={trackingCode}',
  NINJA_VAN: 'https://www.ninjavan.co/en-my/tracking?id={trackingCode}',
  KERRY_EXPRESS: 'https://th.kerryexpress.com/en/track/?track={trackingCode}',
  FLASH_EXPRESS: 'https://www.flashexpress.com/tracking?se={trackingCode}',
};

export function getTrackingUrl(provider: string, trackingNo: string): string {
  const trimmed = trackingNo.trim();
  if (trimmed.length === 0) {
    return '#';
  }
  const key = provider.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const builder = CORE_TRACKING_URLS[key];
  if (builder) {
    return builder(trimmed);
  }
  return '#';
}

export function getTrackingUrlForProvider(
  provider: CargoProvider,
  trackingNumber: string,
): string {
  return getTrackingUrl(provider, trackingNumber);
}

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
  if (key) {
    const direct = getTrackingUrl(key, trimmed);
    if (direct !== '#') {
      return direct;
    }
  }
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
