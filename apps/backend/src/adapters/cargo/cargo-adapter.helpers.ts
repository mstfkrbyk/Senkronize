import { XMLParser } from 'fast-xml-parser';

import type { NormalizedTrackingStatus, TrackingEvent } from '../cargo-adapter.interface';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function soap11Envelope(innerBody: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Body>${innerBody}</soap:Body>
</soap:Envelope>`;
}

export function parseXml(xml: string): unknown {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
  });
  return parser.parse(xml) as unknown;
}

export function getDeepString(obj: unknown, keys: string[]): string | undefined {
  if (obj === null || obj === undefined) {
    return undefined;
  }
  if (typeof obj === 'string' || typeof obj === 'number') {
    return String(obj);
  }
  if (typeof obj !== 'object') {
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = record[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    if (typeof v === 'number') {
      return String(v);
    }
  }
  for (const v of Object.values(record)) {
    const found = getDeepString(v, keys);
    if (found) {
      return found;
    }
  }
  return undefined;
}

const TRACKING_KEY_HINTS = [
  'trackingNumber',
  'trackingCode',
  'waybillNo',
  'waybillNumber',
  'barcode',
  'barkod',
  'gonderiNo',
  'documentNumber',
  'cargoKey',
  'shipmentId',
];

export function extractTrackingCodeFromPayload(data: unknown): string | undefined {
  for (const key of TRACKING_KEY_HINTS) {
    const v = getDeepString(data, [key]);
    if (v && v.length >= 4) {
      return v;
    }
  }
  return undefined;
}

export function normalizeTrackingStatus(raw: string): NormalizedTrackingStatus {
  const s = raw.toLowerCase();
  if (
    s.includes('teslim edildi') ||
    s.includes('delivered') ||
    (s.includes('teslim') && s.includes('edildi'))
  ) {
    return 'DELIVERED';
  }
  if (
    s.includes('dagitim') ||
    s.includes('dağıtım') ||
    s.includes('out for delivery') ||
    s.includes('kurye')
  ) {
    return 'OUT_FOR_DELIVERY';
  }
  if (
    s.includes('iade') ||
    s.includes('return') ||
    s.includes('geri')
  ) {
    return 'RETURNED';
  }
  if (
    s.includes('hata') ||
    s.includes('failed') ||
    s.includes('iptal') ||
    s.includes('reddedildi')
  ) {
    return 'FAILED';
  }
  if (
    s.includes('subede') ||
    s.includes('transfer') ||
    s.includes('yolda') ||
    s.includes('transit') ||
    s.includes('in transit') ||
    s.includes('sevk')
  ) {
    return 'IN_TRANSIT';
  }
  if (
    s.includes('olustur') ||
    s.includes('oluştur') ||
    s.includes('created') ||
    s.includes('kabul')
  ) {
    return 'CREATED';
  }
  return 'IN_TRANSIT';
}

export function singleEventFromText(
  trackingCode: string,
  text: string,
): TrackingEvent[] {
  const now = new Date();
  return [
    {
      timestamp: now,
      status: text.slice(0, 80),
      description: text,
      location: undefined,
    },
  ];
}

export function requireStringField(
  creds: Record<string, unknown>,
  field: string,
): string {
  const v = creds[field];
  if (typeof v === 'string' && v.trim().length > 0) {
    return v.trim();
  }
  throw new Error(`Kimlik bilgisinde "${field}" eksik veya geçersiz`);
}

export function optionalStringField(
  creds: Record<string, unknown>,
  field: string,
): string | undefined {
  const v = creds[field];
  if (typeof v === 'string' && v.trim().length > 0) {
    return v.trim();
  }
  return undefined;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== undefined && value !== null) {
    return [value];
  }
  return [];
}

const BASE64_PDF_HINTS = [
  'labelData',
  'LabelData',
  'labelPdf',
  'LabelPdf',
  'pdfContent',
  'PdfContent',
  'base64',
  'Base64',
  'cargoLabel',
  'CargoLabel',
];

export function extractBase64PdfFromPayload(data: unknown): Buffer | null {
  for (const key of BASE64_PDF_HINTS) {
    const raw = getDeepString(data, [key]);
    if (raw && raw.length > 100) {
      try {
        const buf = Buffer.from(raw, 'base64');
        if (buf.length > 50) {
          return buf;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Desi ağırlığına göre yurt içi tahmini kargo ücreti (TRY) */
export function estimateDomesticCargoPrice(
  weightKg: number,
  desi: number | undefined,
  baseFee: number,
  perDesi: number,
): CargoRateEstimate {
  const chargeDesi = Math.max(1, desi ?? weightKg);
  const price = Math.round((baseFee + chargeDesi * perDesi) * 100) / 100;
  return {
    serviceName: 'Standart Gönderi',
    price,
    currency: 'TRY',
    transitDaysMin: 2,
    transitDaysMax: 4,
  };
}

export interface CargoRateEstimate {
  serviceName: string;
  price: number;
  currency: string;
  transitDaysMin?: number;
  transitDaysMax?: number;
}
